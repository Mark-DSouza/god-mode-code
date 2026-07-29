package dev.markdsouza.godmodecode.pattern;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * The difficulty band of a Challenge.
 *
 * Named for career stages rather than Easy/Medium/Hard because the Code
 * Discipline is about techniques a working engineer reaches for, and "Principal"
 * says something about the kind of thinking rather than about how long it takes.
 */
@Schema(description = "The difficulty band of a Challenge")
public enum Seniority {
    JUNIOR,
    SENIOR,
    PRINCIPAL
}
