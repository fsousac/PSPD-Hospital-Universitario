// Package clients abre e mantém as conexões gRPC do gateway com os três
// microsserviços internos (Authorization, Patient Data, Data Transform).
//
// As conexões usam credenciais "insecure" (h2c/plaintext) porque a comunicação
// é interna ao cluster/rede docker — o TLS de borda fica no ingress do K8S.
package clients

import (
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/connectivity"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/rabelzx/hu-gateway/internal/config"
	authpb "github.com/rabelzx/hu-gateway/internal/pb/authpb"
	patientpb "github.com/rabelzx/hu-gateway/internal/pb/patientpb"
	transformpb "github.com/rabelzx/hu-gateway/internal/pb/transformpb"
)

type Clients struct {
	Auth      authpb.AuthorizationServiceClient
	Patient   patientpb.PatientDataServiceClient
	Transform transformpb.DataTransformServiceClient

	conns []*grpc.ClientConn
}

// New abre uma conexão gRPC para cada serviço. As conexões são lazy: o gRPC só
// estabelece o socket na primeira chamada, então New não falha se um serviço
// ainda estiver subindo.
func New(cfg config.Config) (*Clients, error) {
	opts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
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

	return &Clients{
		Auth:      authpb.NewAuthorizationServiceClient(authConn),
		Patient:   patientpb.NewPatientDataServiceClient(patientConn),
		Transform: transformpb.NewDataTransformServiceClient(transformConn),
		conns:     []*grpc.ClientConn{authConn, patientConn, transformConn},
	}, nil
}

func dial(name, addr string, opts []grpc.DialOption) (*grpc.ClientConn, error) {
	conn, err := grpc.NewClient(addr, opts...)
	if err != nil {
		return nil, fmt.Errorf("dial %s (%s): %w", name, addr, err)
	}
	return conn, nil
}

// Close fecha todas as conexões gRPC.
func (c *Clients) Close() {
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
