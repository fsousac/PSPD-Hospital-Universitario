# `privateKey.pem` / `publicKey.pem` — chaves de teste, não são segredos

Par RSA gerado só para assinar/verificar JWTs dentro da suíte de testes
automatizada (`TestTokens.java` assina, `AuthorizationGrpcServiceIT` e o
`JWTParser` do serviço verificam). Não protegem nada real:

- Usadas **exclusivamente** no profile `%test` (`application.properties`,
  seção "Testes"). O profile `%dev`/`%prod` valida contra o JWKS de um
  Keycloak de verdade (`mp.jwt.verify.publickey.location` apontando para
  `.../protocol/openid-connect/certs`) — nunca contra este arquivo.
- Não assinam nem verificam nenhum token usado fora da JVM de teste.
- São descartáveis: regenerar a qualquer momento sem quebrar nada além dos
  próprios testes.

Comitadas de propósito (projeto acadêmico, sem exigência de rigor de
segredo comercial) para a suíte de testes ser reproduzível sem passo manual
extra. Se algum dia esse padrão for reaproveitado num contexto real, troque
por um par gerado em CI/efêmero — nunca reuse este.

Para regenerar:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out privateKey.pem
openssl rsa -pubout -in privateKey.pem -out publicKey.pem
```
