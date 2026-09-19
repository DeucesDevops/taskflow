package com.taskflow.projects.auth;

import com.taskflow.projects.api.ApiException;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Component
public class AuthClient {
    private final RestClient client;

    public AuthClient(@Value("${taskflow.auth-service-url}") String baseUrl) {
        var http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
        var requests = new JdkClientHttpRequestFactory(http);
        requests.setReadTimeout(Duration.ofSeconds(3));
        client = RestClient.builder().baseUrl(baseUrl).requestFactory(requests).build();
    }

    public UUID authenticate(String authorization) {
        validateAuthorization(authorization);
        try {
            AuthResponse response = client.get().uri("/auth/me")
                .header(HttpHeaders.AUTHORIZATION, authorization).retrieve().body(AuthResponse.class);
            if (response == null || response.user() == null || response.user().id() == null) {
                throw unavailable();
            }
            return response.user().id();
        } catch (RestClientResponseException error) {
            if (error.getStatusCode().value() == 401 || error.getStatusCode().value() == 403) {
                throw unauthorized();
            }
            throw unavailable();
        } catch (RestClientException error) {
            throw unavailable();
        }
    }

    public User findUserByEmail(String email, String authorization) {
        validateAuthorization(authorization);
        return resolveUser(() -> client.get().uri(builder -> builder.path("/auth/users")
            .queryParam("email", "{email}").build(email))
            .header(HttpHeaders.AUTHORIZATION, authorization).retrieve().body(AuthResponse.class));
    }

    public User findUserById(UUID id, String authorization) {
        validateAuthorization(authorization);
        return resolveUser(() -> client.get().uri("/auth/users/{id}", id)
            .header(HttpHeaders.AUTHORIZATION, authorization).retrieve().body(AuthResponse.class));
    }

    private User resolveUser(java.util.function.Supplier<AuthResponse> request) {
        try {
            AuthResponse response = request.get();
            if (response == null || response.user() == null || response.user().id() == null
                    || response.user().name() == null || response.user().email() == null) {
                throw unavailable();
            }
            return response.user();
        } catch (RestClientResponseException error) {
            if (error.getStatusCode().value() == 404) {
                throw new ApiException(HttpStatus.NOT_FOUND, "User not found.");
            }
            if (error.getStatusCode().value() == 401 || error.getStatusCode().value() == 403) {
                throw unauthorized();
            }
            throw unavailable();
        } catch (RestClientException error) {
            throw unavailable();
        }
    }

    private void validateAuthorization(String authorization) {
        if (authorization == null || !authorization.matches("(?i)Bearer [^\\s]{1,4096}")) {
            throw unauthorized();
        }
    }

    public boolean isReady() {
        try {
            return client.get().uri("/ready").retrieve().toBodilessEntity().getStatusCode().is2xxSuccessful();
        } catch (RestClientException error) {
            return false;
        }
    }

    private ApiException unauthorized() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "Please sign in to continue.");
    }

    private ApiException unavailable() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Authentication is temporarily unavailable.");
    }

    public record AuthResponse(User user) {}
    public record User(UUID id, String name, String email) {}
}
