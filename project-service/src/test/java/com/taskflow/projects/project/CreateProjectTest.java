package com.taskflow.projects.project;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CreateProjectTest {
    @Test
    void validatesRequiredNameAndStorageBounds() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            assertFalse(validator.validate(new CreateProject("   ", "")).isEmpty());
            assertFalse(validator.validate(new CreateProject("x".repeat(121), "")).isEmpty());
            assertFalse(validator.validate(new CreateProject("Valid", "x".repeat(2001))).isEmpty());
            assertTrue(validator.validate(new CreateProject("Valid", null)).isEmpty());
        }
    }
}
