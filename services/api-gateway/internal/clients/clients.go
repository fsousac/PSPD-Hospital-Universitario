// Package clients abre e mantém as conexões gRPC do gateway com os três
// microsserviços internos (Authorization, Patient Data, Data Transform).
//
// As conexões usam credenciais "insecure" (h2c/plaintext) porque a comunicação
// é interna ao cluster/rede docker — o TLS de borda fica no ingress do K8S.
package clients

import (
	"fmt"
	"sync"
	"time"

	"google.golang.org/grpc"
	_ "google.golang.org/grpc/balancer/roundrobin" // registra a policy "round_robin" usada no service config abaixo
	"google.golang.org/grpc/connectivity"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/resolver"

	"github.com/rabelzx/hu-gateway/internal/config"
	authpb "github.com/rabelzx/hu-gateway/internal/pb/authpb"
	patientpb "github.com/rabelzx/hu-gateway/internal/pb/patientpb"
	transformpb "github.com/rabelzx/hu-gateway/internal/pb/transformpb"
)

// resolveNowInterval força uma nova consulta DNS periódica nas 3 conexões
// gRPC (ver startResolveLoop). O resolver padrão do grpc-go só reconsulta o
// DNS do Service headless no próprio ciclo (bem mais longo) ou quando uma
// conexão existente entra em TransientFailure — nenhum dos dois dispara
// quando o HPA simplesmente soma um pod novo sem nada falhar, então uma
// réplica nova pode ficar de fora do pool de round_robin pelo resto do teste
// (hipótese em investigação no ADR 0005). 12s foi escolhido por ficar abaixo
// do --horizontal-pod-autoscaler-sync-period padrão do k8s (15s): a réplica
// nova entra no resolver antes do próximo ciclo de decisão do HPA.
const resolveNowInterval = 12 * time.Second

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
		// o resolver DNS devolver, e réplicas extras do backend nunca recebem
		// tráfego. Exige Service headless (clusterIP: None) do lado do
		// backend, senão o DNS resolve pra um único ClusterIP e o
		// round_robin não tem o que balancear (ver k8s/*.yaml e
		// docs/decisions/0005).
		grpc.WithDefaultServiceConfig(`{"loadBalancingConfig": [{"round_robin":{}}]}`),
		// Keepalive: o padrão de carga aqui é rajada (k6 sobe/desce VUs), não
		// tráfego constante — entre rajadas as 3 conexões ficam ociosas. Sem
		// nenhum keepalive configurado (estado anterior), uma conexão que
		// morreu silenciosamente durante o intervalo ocioso (ex.: pod
		// reciclado sem eleger TransientFailure a tempo) só seria percebida
		// na próxima chamada real. PermitWithoutStream:true manda pings
		// mesmo sem RPC em andamento para detectar isso antes da próxima
		// rajada. Time em 6min (não os 10s/30s comuns em exemplos do
		// grpc-go) porque nenhum dos 3 backends (grep confirmado) configura
		// keepalive.EnforcementPolicy — todos rodam com o default de
		// MinTime=5min para pings sem stream ativo; um Time mais agressivo
		// aqui acionaria "too_many_pings"/GOAWAY nos backends. Se algum
		// backend passar a declarar EnforcementPolicy própria (mais
		// permissiva), este Time pode cair para detectar conexões mortas
		// mais rápido.
		grpc.WithKeepaliveParams(keepalive.ClientParameters{
			Time:                6 * time.Minute,
			Timeout:             20 * time.Second,
			PermitWithoutStream: true,
		}),
	}

	authConn, err := dial("authorization-service", cfg.AuthServiceAddr, opts)
	if err != nil {
		return nil, err
	}
	patientConn, err := dial("patient-data-service", cfg.PatientDataServiceAddr, opts)
	if err != nil {
		return nil, err
	}
	transformConn, err := dial("data-transform-service", cfg.DataTransformServiceAddr, opts)
	if err != nil {
		return nil, err
	}

	c := &Clients{
		Auth:      authpb.NewAuthorizationServiceClient(authConn),
		Patient:   patientpb.NewPatientDataServiceClient(patientConn),
		Transform: transformpb.NewDataTransformServiceClient(transformConn),
		conns:     []*grpc.ClientConn{authConn, patientConn, transformConn},
		stop:      make(chan struct{}),
	}
	c.startResolveLoop()
	return c, nil
}

// startResolveLoop roda em background e força ResolveNow() nas 3 conexões a
// cada resolveNowInterval (ver comentário na constante). ResolveNow apenas
// pede ao resolver DNS pra reconsultar agora; é assíncrono e não bloqueia —
// barato o suficiente pra rodar num intervalo curto sem pesar no gateway.
func (c *Clients) startResolveLoop() {
	c.wg.Add(1)
	go func() {
		defer c.wg.Done()
		ticker := time.NewTicker(resolveNowInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				for _, conn := range c.conns {
					conn.ResolveNow(resolver.ResolveNowOptions{})
				}
			case <-c.stop:
				return
			}
		}
	}()
}

func dial(name, addr string, opts []grpc.DialOption) (*grpc.ClientConn, error) {
	// dns:///: força o resolver DNS mesmo sem porta customizada — sem o
	// esquema explícito, versões do grpc-go variam entre "dns" e
	// "passthrough" como default, e passthrough nunca reconsulta múltiplos
	// IPs (não há round_robin possível).
	conn, err := grpc.NewClient("dns:///"+addr, opts...)
	if err != nil {
		return nil, fmt.Errorf("dial %s (%s): %w", name, addr, err)
	}
	return conn, nil
}

// Close para a goroutine de ResolveNow e fecha todas as conexões gRPC.
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
