package dev.markdsouza.godmodecode.user;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
class UserRepository {

    /**
     * `claimed` is derived from the credential reference rather than stored
     * beside it, so the two cannot disagree — which is the whole point of
     * ADR-0007's single row.
     */
    private static final RowMapper<User> AS_USER = (rs, rowNum) -> new User(
            rs.getObject("id", UUID.class),
            rs.getString("handle"),
            rs.getString("credential_subject") != null);

    private final JdbcTemplate jdbc;

    UserRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Inserts a User with the given Handle, or reports that the Handle is taken.
     *
     * {@code ON CONFLICT (handle) DO NOTHING} is what makes the database the
     * arbiter of uniqueness rather than the application. A read-then-insert would
     * be a race with a window between the two statements; this is one statement,
     * decided by the unique index, and two sessions racing for the same Handle
     * cannot both come back with a row.
     *
     * Scoped to the handle index on purpose. A conflict on the recognition key
     * would be a freshly generated 256-bit value colliding — which does not
     * happen, and if it ever did, silently suffixing someone's Handle is the
     * wrong response. That one still throws.
     *
     * @return the created User, or empty if the Handle was already taken.
     */
    Optional<User> insertIfHandleFree(String handle, String recognitionKeyHash) {
        List<User> created = jdbc.query(
                """
                INSERT INTO users (handle, recognition_key_hash)
                VALUES (?, ?)
                ON CONFLICT (handle) DO NOTHING
                RETURNING id, handle, credential_subject
                """,
                AS_USER,
                handle,
                recognitionKeyHash);
        return created.stream().findFirst();
    }

    /** The User whose browser holds this key, if any. */
    Optional<User> findByRecognitionKeyHash(String recognitionKeyHash) {
        return jdbc
                .query(
                        "SELECT id, handle, credential_subject FROM users WHERE recognition_key_hash = ?",
                        AS_USER,
                        recognitionKeyHash)
                .stream()
                .findFirst();
    }
}
