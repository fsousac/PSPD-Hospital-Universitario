// Package clients abre e mantém as conexões gRPC do gateway com os três
// microsserviços internos (Authorization, Patient Data, Data Transform).
//
// As conexões usam credenciais "insecure" (h2c/plaintext) porque a comunicação
// é interna ao cluster/rede docker — o TLS de borda fica no ingress do K8S.
package clients

import (
	"context"
	"fmt"
	"net"
	"sync"
	"time"

	"google.golang.org/grpc"
	_ "google.golang.org/grpc/balancer/roundrobin" // registra a policy "round_robin" usada no service config abaixo
	"google.golang.org/grpc/connectivity"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/resolver"
	"google.golang.org/grpc/resolver/manual"

	"github.com/rabelzx/hu-gateway/internal/config"
	authpb "github.com/rabelzx/hu-gateway/internal/pb/authpb"
	patientpb "github.com/rabelzx/hu-gateway/internal/pb/patientpb"
	transformpb "github.com/rabelzx/hu-gateway/internal/pb/transformpb"
)

// refreshInterval: menor que o sync period do HPA (15s). O resolver "dns"
// padrão do grpc-go não reconsulta sozinho depois do primeiro lookup — só
// reage a ResolveNow(), que *grpc.ClientConn não expõe publicamente (ver
// docs/decisions/0005). Por isso usamos um resolver manual com lookup
// próprio nesse intervalo.
const refreshInterval = 12 * time.Second

type Clients struct {
	Auth      authpb.AuthorizationServiceClient
	Patient   patientpb.PatientDataServiceClient
	Transform transformpb.DataTransformServiceClient

	conns []*grpc.ClientConn
	stop  chan struct{}
	wg    sync.WaitGroup
}

// New abre uma conexão gRPC para cada serviço. As conexões são lazy: o gRPC só
// estabelece o socket na primeira chamada, então New não falha se um serviço
// ainda estiver subindo.
func New(cfg config.Config) (*Clients, error) {
	opts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		// round_robin: sem isso, a conexão HTTP/2 única (aberta uma vez e
		// reaproveitada por todo o processo) fica pinada no primeiro pod que
		// o resolver devolver, e réplicas extras do backend nunca recebem
		// tráfego (ver k8s/*.yaml e docs/decisions/0005).
		grpc.WithDefaultServiceConfig(`{"loadBalancingConfig": [{"round_robin":{}}]}`),
		// Time acima do MinTime=5min default dos 3 backends (nenhum declara
		// keepalive.EnforcementPolicy própria) pra não levar GOAWAY/too_many_pings.
		grpc.WithKeepaliveParams(keepalive.ClientParameters{
			Time:                6 * time.Minute,
			Timeout:             20 * time.Second,
			PermitWithoutStream: true,
		}),
	}

	c := &Clients{stop: make(chan struct{})}

	authConn, err := c.dial("authorization-service", "hugwauth", cfg.AuthServiceAddr, opts)
	if err != nil {
		return nil, err
	}
	patientConn, err := c.dial("patient-data-service", "hugwpatient", cfg.PatientDataServiceAddr, opts)
	if err != nil {
		return nil, err
	}
	transformConn, err := c.dial("data-transform-service", "hugwtransform", cfg.DataTransformServiceAddr, opts)
	if err != nil {
		return nil, err
	}

	c.Auth = authpb.NewAuthorizationServiceClient(authConn)
	c.Patient = patientpb.NewPatientDataServiceClient(patientConn)
	c.Transform = transformpb.NewDataTransformServiceClient(transformConn)
	c.conns = []*grpc.ClientConn{authConn, patientConn, transformConn}
	return c, nil
}

// dial abre a conexão com um resolver manual (scheme só desta conexão) e
// inicia o refresh periódico de endereços (ver refreshLoop).
func (c *Clients) dial(name, scheme, addr string, opts []grpc.DialOption) (*grpc.ClientConn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, fmt.Errorf("dial %s (%s): %w", name, addr, err)
	}

	r := manual.NewBuilderWithScheme(scheme)
	dialOpts := append(append([]grpc.DialOption{}, opts...), grpc.WithResolvers(r))
	conn, err := grpc.NewClient(scheme+":///"+host, dialOpts...)
	if err != nil {
		return nil, fmt.Errorf("dial %s (%s): %w", name, addr, err)
	}

	c.wg.Add(1)
	go c.refreshLoop(r, host, port)
	return conn, nil
}

// refreshLoop resolve o host via DNS (net.DefaultResolver, o mesmo usado
// pelo resolver "dns" padrão) e empurra os endereços pro resolver manual a
// cada refreshInterval — falha de lookup mantém os endereços anteriores.
func (c *Clients) refreshLoop(r *manual.Resolver, host, port string) {
	defer c.wg.Done()

	refresh := func() {
		ips, err := net.DefaultResolver.LookupHost(context.Background(), host)
		if err != nil {
			return
		}
		addrs := make([]resolver.Address, len(ips))
		for i, ip := range ips {
			addrs[i] = resolver.Address{Addr: net.JoinHostPort(ip, port)}
		}
		r.UpdateState(resolver.State{Addresses: addrs})
	}

	refresh()
	ticker := time.NewTicker(refreshInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			refresh()
		case <-c.stop:
			return
		}
	}
}

// Close para as goroutines de refresh e fecha todas as conexões gRPC.
func (c *Clients) Close() {
	close(c.stop)
	c.wg.Wait()
	for _, conn := range c.conns {
		_ = conn.Close()
	}
}

// Ready reporta se nenhuma das conexões gRPC upstream está em estado de
// falha. Uma conexão nunca usada fica Idle (dial é lazy) — isso ainda conta
// como pronta, só TransientFailure/Shutdown indicam um backend indisponível.
// Connect() dispara a tentativa de conexão sem bloquear a chamada.
func (c *Clients) Ready() bool {
	for _, conn := range c.conns {
		conn.Connect()
		switch conn.GetState() {
		case connectivity.TransientFailure, connectivity.Shutdown:
			return false
		}
	}
	return true
}
