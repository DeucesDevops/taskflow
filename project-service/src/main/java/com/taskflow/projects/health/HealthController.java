package com.taskflow.projects.health;

import com.taskflow.projects.api.ApiException;
import com.taskflow.projects.auth.AuthClient;
import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
    private final JdbcTemplate jdbc;
    private final AuthClient auth;

    public HealthController(JdbcTemplate jdbc, AuthClient auth) {
        this.jdbc = jdbc;
        this.auth = auth;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "service", "project-service");
    }

    @GetMapping("/ready")
    public Map<String, String> ready() {
        try {
            jdbc.queryForObject("SELECT 1", Integer.class);
            if (!auth.isReady()) {
                throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Project dependencies are not ready.");
            }
            return Map.of("status", "ok", "service", "project-service");
        } catch (DataAccessException error) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Project dependencies are not ready.");
        }
    }
}
