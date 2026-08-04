package dev.markdsouza.godmodecode.user;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
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

    /** The User already Claimed with this credential, if signing in has been done before. */
    Optional<User> findByCredentialSubject(String credentialSubject) {
        return jdbc
                .query(
                        "SELECT id, handle, credential_subject FROM users WHERE credential_subject = ?",
                        AS_USER,
                        credentialSubject)
                .stream()
                .findFirst();
    }

    /**
     * Attaches credentials to an Unclaimed User and gives it the Handle chosen on
     * Claiming, retiring the generated one.
     *
     * {@code WHERE credential_subject IS NULL} is the same belt the caller's own
     * check is the braces for: two Claiming requests for the same browser racing
     * each other must not both succeed, and this is what a second one finds
     * nothing to update.
     *
     * @return the Claimed User, or empty if the chosen Handle was already taken.
     */
    Optional<User> claim(UUID userId, String credentialSubject, String handle) {
        try {
            List<User> claimed = jdbc.query(
                    """
                    UPDATE users
                    SET credential_subject = ?, handle = ?
                    WHERE id = ? AND credential_subject IS NULL
                    RETURNING id, handle, credential_subject
                    """,
                    AS_USER,
                    credentialSubject,
                    handle,
                    userId);
            return claimed.stream().findFirst();
        } catch (DuplicateKeyException alreadyTaken) {
            return Optional.empty();
        }
    }

    /**
     * Rotates the Recognition Key a User's row is found by.
     *
     * Used only when merging: the browser's old key named the row that is about
     * to be deleted, so the target it is being recognised as from now on needs a
     * key of its own for this browser to hold.
     */
    void updateRecognitionKeyHash(UUID userId, String recognitionKeyHash) {
        jdbc.update("UPDATE users SET recognition_key_hash = ? WHERE id = ?", recognitionKeyHash, userId);
    }

    /** Removes a User whose Runs have already been reattributed elsewhere. */
    void delete(UUID userId) {
        jdbc.update("DELETE FROM users WHERE id = ?", userId);
    }
}
