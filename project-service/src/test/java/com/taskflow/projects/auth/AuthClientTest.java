package com.taskflow.projects.auth;

import com.sun.net.httpserver.HttpServer;
import com.taskflow.projects.api.ApiException;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.*;

class AuthClientTest {
    private HttpServer server;
    private AuthClient client;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.start();
        client = new AuthClient("http://127.0.0.1:" + server.getAddress().getPort());
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void forwardsBearerAndUsesAuthUserIdentity() {
        AtomicReference<String> forwarded = new AtomicReference<>();
        UUID id = UUID.fromString("11111111-1111-4111-8111-111111111111");
        server.createContext("/auth/me", exchange -> {
            forwarded.set(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] body = ("{\"user\":{\"id\":\"" + id + "\",\"name\":\"Alex\",\"email\":\"alex@example.test\"}}")
                .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        assertEquals(id, client.authenticate("Bearer valid-token"));
        assertEquals("Bearer valid-token", forwarded.get());
    }

    @Test
    void rejectsMissingOrMalformedCredentialsBeforeContactingAuth() {
        assertStatus(HttpStatus.UNAUTHORIZED, () -> client.authenticate(null));
        assertStatus(HttpStatus.UNAUTHORIZED, () -> client.authenticate("Basic secret"));
        assertStatus(HttpStatus.UNAUTHORIZED, () -> client.authenticate("Bearer "));
        assertStatus(HttpStatus.UNAUTHORIZED, () -> client.authenticate("Bearer token\r\nBad: injected"));
    }

    @Test
    void distinguishesInvalidSessionFromServiceFailure() {
        stub(401, "{\"error\":\"expired\"}");
        assertStatus(HttpStatus.UNAUTHORIZED, () -> client.authenticate("Bearer expired"));
        server.removeContext("/auth/me");
        stub(503, "{\"error\":\"redis unavailable\"}");
        assertStatus(HttpStatus.SERVICE_UNAVAILABLE, () -> client.authenticate("Bearer valid"));
    }

    @Test
    void treatsMalformedAuthResponseAsDependencyFailure() {
        stub(200, "{\"user\":{\"id\":\"not-a-uuid\"}}");
        assertStatus(HttpStatus.SERVICE_UNAVAILABLE, () -> client.authenticate("Bearer valid"));
    }

    @Test
    void treatsMissingUserAsDependencyFailure() {
        stub(200, "{}");
        assertStatus(HttpStatus.SERVICE_UNAVAILABLE, () -> client.authenticate("Bearer valid"));
    }

    @Test
    void acceptsLargerJwtButStillCapsTokenLength() {
        UUID id = UUID.randomUUID();
        stub(200, "{\"user\":{\"id\":\"" + id + "\"}}");
        assertEquals(id, client.authenticate("Bearer " + "a".repeat(1024)));
        assertStatus(HttpStatus.UNAUTHORIZED, () -> client.authenticate("Bearer " + "a".repeat(4097)));
    }

    @Test
    void looksUpMembersUsingEncodedEmailAndForwardedBearer() {
        UUID id = UUID.randomUUID();
        AtomicReference<String> query = new AtomicReference<>();
        AtomicReference<String> forwarded = new AtomicReference<>();
        server.createContext("/auth/users", exchange -> {
            query.set(exchange.getRequestURI().getRawQuery());
            forwarded.set(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] body = ("{\"user\":{\"id\":\"" + id + "\",\"name\":\"Alex\",\"email\":\"alex+team@example.test\"}}")
                .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        assertEquals(id, client.findUserByEmail("alex+team@example.test", "Bearer valid").id());
        assertEquals("email=alex%2Bteam%40example.test", query.get());
        assertEquals("Bearer valid", forwarded.get());
    }

    @Test
    void resolvesOwnerByIdAndClassifiesUnknownUsers() {
        UUID id = UUID.randomUUID();
        server.createContext("/auth/users/" + id, exchange -> {
            byte[] body = ("{\"user\":{\"id\":\"" + id + "\",\"name\":\"Owner\",\"email\":\"owner@example.test\"}}")
                .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        assertEquals(id, client.findUserById(id, "Bearer valid").id());
        assertStatus(HttpStatus.NOT_FOUND, () -> client.findUserById(UUID.randomUUID(), "Bearer valid"));
        assertStatus(HttpStatus.UNAUTHORIZED, () -> client.findUserByEmail("a@example.test", null));
    }

    private void stub(int status, String response) {
        server.createContext("/auth/me", exchange -> {
            byte[] body = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
    }

    private void assertStatus(HttpStatus status, Runnable call) {
        assertEquals(status, assertThrows(ApiException.class, call::run).status());
    }
}
