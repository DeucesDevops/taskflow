package com.taskflow.projects.api;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class ApiErrorHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiErrorHandler.class);

    @ExceptionHandler(ApiException.class)
    ResponseEntity<Map<String, String>> api(ApiException error) {
        return response(error.status(), error.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, String>> validation() {
        return response(HttpStatus.BAD_REQUEST, "Name is required (1–120 characters); description must be at most 2000 characters.");
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<Map<String, String>> invalidInput() {
        return response(HttpStatus.BAD_REQUEST, "Invalid request body or project ID.");
    }

    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<Map<String, String>> database(DataAccessException error) {
        log.warn("Project database request failed: {}", error.getClass().getSimpleName());
        return response(HttpStatus.SERVICE_UNAVAILABLE, "Project storage is temporarily unavailable.");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<Map<String, String>> missing() {
        return response(HttpStatus.NOT_FOUND, "Resource not found.");
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<Map<String, String>> method() {
        return response(HttpStatus.METHOD_NOT_ALLOWED, "Method not allowed.");
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    ResponseEntity<Map<String, String>> mediaType() {
        return response(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Use application/json.");
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, String>> unexpected(Exception error) {
        log.error("Unexpected project service failure", error);
        return response(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to process this request.");
    }

    private ResponseEntity<Map<String, String>> response(HttpStatus status, String error) {
        return ResponseEntity.status(status).body(Map.of("error", error));
    }
}
