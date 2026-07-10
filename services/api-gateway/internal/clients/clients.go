// Package clients abre e mantém as conexões gRPC do gateway com os três
// microsserviços internos (Authorization, Patient Data, Data Transform).
//
// As conexões usam credenciais "insecure" (h2c/plaintext) porque a comunicação
// é interna ao cluster/rede docker — o TLS de borda fica no ingress do K8S.
package clients

import (
	"fmt"

	"google.golang.org/grpc"
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

	authConn, err := grpc.NewClient(cfg.AuthServiceAddr, opts...)
	if err != nil {
		return nil, fmt.Errorf("dial authorization-service (%s): %w", cfg.AuthServiceAddr, err)
	}
	patientConn, err := grpc.NewClient(cfg.PatientDataServiceAddr, opts...)
	if err != nil {
		return nil, fmt.Errorf("dial patient-data-service (%s): %w", cfg.PatientDataServiceAddr, err)
	}
	transformConn, err := grpc.NewClient(cfg.DataTransformServiceAddr, opts...)
	if err != nil {
		return nil, fmt.Errorf("dial data-transform-service (%s): %w", cfg.DataTransformServiceAddr, err)
	}

	return &Clients{
		Auth:      authpb.NewAuthorizationServiceClient(authConn),
		Patient:   patientpb.NewPatientDataServiceClient(patientConn),
		Transform: transformpb.NewDataTransformServiceClient(transformConn),
		conns:     []*grpc.ClientConn{authConn, patientConn, transformConn},
	}, nil
}

// Close fecha todas as conexões gRPC.
func (c *Clients) Close() {
	for _, conn := range c.conns {
		_ = conn.Close()
	}
}
