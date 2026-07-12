package gateway

import (
	"testing"

	"github.com/rabelzx/hu-gateway/internal/config"
)

func testGateway(key string) *Gateway {
	return &Gateway{cfg: config.Config{CohortPseudonymKey: []byte(key)}}
}

// Regressão: pseudonym precisa depender da chave secreta (não é mais SHA-256
// puro, que seria reversível por força bruta sobre o espaço enumerável de
// patient_id — ver comentário na função).
func TestPseudonymDependeDaChave(t *testing.T) {
	g1 := testGateway("chave-de-teste-com-32-bytes-ok!!")
	g2 := testGateway("outra-chave-de-teste-32-bytes-ok")

	p1 := g1.pseudonym("P000001", "PRJ-01")
	p2 := g2.pseudonym("P000001", "PRJ-01")

	if p1 == p2 {
		t.Fatalf("pseudonym não deveria depender só do patient_id: %q == %q com chaves diferentes", p1, p2)
	}
}

func TestPseudonymEstavelParaMesmaEntrada(t *testing.T) {
	g := testGateway("chave-de-teste-com-32-bytes-ok!!")
	if g.pseudonym("P000001", "PRJ-01") != g.pseudonym("P000001", "PRJ-01") {
		t.Fatal("pseudonym deveria ser determinístico para a mesma entrada")
	}
}

// Projetos diferentes não podem produzir o mesmo pseudônimo para o mesmo
// paciente (evita cruzar dados entre coortes de pesquisa distintas).
func TestPseudonymVariaPorProjeto(t *testing.T) {
	g := testGateway("chave-de-teste-com-32-bytes-ok!!")
	if g.pseudonym("P000001", "PRJ-01") == g.pseudonym("P000001", "PRJ-02") {
		t.Fatal("pseudonym deveria variar por projectID")
	}
}
