package br.unb.pspd.hu.auth.grpc;

import br.unb.pspd.hu.auth.decision.AuthorizationDecisionService;
import br.unb.pspd.hu.auth.decision.AuthorizationDecisionService.DecisionResult;
import br.unb.pspd.hu.auth.security.InvalidTokenException;
import br.unb.pspd.hu.auth.security.JwtClaims;
import br.unb.pspd.hu.auth.security.TokenValidationService;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.quarkus.grpc.GrpcService;
import io.smallrye.common.annotation.Blocking;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;

@GrpcService
public class AuthorizationGrpcService implements AuthorizationService {

    private final TokenValidationService tokenValidationService;
    private final AuthorizationDecisionService decisionService;
    private final MeterRegistry meterRegistry;

    @Inject
    public AuthorizationGrpcService(
            TokenValidationService tokenValidationService,
            AuthorizationDecisionService decisionService,
            MeterRegistry meterRegistry) {
        this.tokenValidationService = tokenValidationService;
        this.decisionService = decisionService;
        this.meterRegistry = meterRegistry;
    }

    @Override
    @Blocking
    public Uni<AuthorizeResponse> authorize(AuthorizeRequest request) {
        Timer.Sample sample = Timer.start(meterRegistry);
        return Uni.createFrom().item(() -> doAuthorize(request))
                .invoke(response -> {
                    sample.stop(meterRegistry.timer("authorization_decision_duration_seconds"));
                    meterRegistry.counter("authorization_requests_total", "result", response.getAllowed() ? "allow" : "deny")
                            .increment();
                });
    }

    private AuthorizeResponse doAuthorize(AuthorizeRequest request) {
        JwtClaims claims;
        try {
            claims = tokenValidationService.validate(request.getJwtToken());
        } catch (InvalidTokenException e) {
            return AuthorizeResponse.newBuilder()
                    .setAllowed(false)
                    .setAccessLevel(AccessLevel.ACCESS_LEVEL_UNSPECIFIED)
                    .setReason(e.getMessage())
                    .build();
        }

        DecisionResult decision = decisionService.decide(
                claims, request.getResourceType(), request.getResourceId(), request.getAction());

        return AuthorizeResponse.newBuilder()
                .setAllowed(decision.allowed())
                .setAccessLevel(decision.accessLevel())
                .setReason(decision.reason())
                .setSubjectId(claims.username())
                .build();
    }

    @Override
    public Uni<ValidateTokenResponse> validateToken(ValidateTokenRequest request) {
        return Uni.createFrom().item(() -> {
            try {
                JwtClaims claims = tokenValidationService.validate(request.getJwtToken());
                return ValidateTokenResponse.newBuilder()
                        .setValid(true)
                        .setSubjectId(claims.username())
                        .addAllRoles(claims.roles())
                        .build();
            } catch (InvalidTokenException e) {
                return ValidateTokenResponse.newBuilder()
                        .setValid(false)
                        .setReason(e.getMessage())
                        .build();
            }
        });
    }
}
