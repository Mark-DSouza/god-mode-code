package dev.markdsouza.godmodecode.typing;

import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
class PassageRepository {

    private static final RowMapper<Passage> AS_PASSAGE = (rs, rowNum) -> new Passage(
            rs.getObject("id", UUID.class),
            Discipline.valueOf(rs.getString("discipline")),
            rs.getString("text"),
            rs.getString("attribution"),
            rs.getInt("character_count"));

    private static final String COLUMNS = "id, discipline, text, attribution, character_count";

    private final JdbcTemplate jdbc;

    PassageRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Any Passage in this Discipline, chosen by the database.
     *
     * {@code ORDER BY random()} sorts the whole catalogue to take one row, which
     * is the wrong shape for a table of any size — but the catalogue is
     * currently two dozen rows and this is honest about being a random draw.
     * The alternative worth having is not a cleverer query; it is remembering
     * what a User has already been given, which is a later ticket and changes
     * this method's signature anyway.
     *
     * @return empty when the Discipline has no Passages at all, which is the
     *         permanent state of Code (ADR-0004) and the temporary state of any
     *         Discipline whose content migration has not landed.
     */
    Optional<Passage> pickRandomIn(Discipline discipline) {
        return jdbc
                .query(
                        "SELECT " + COLUMNS + " FROM passages WHERE discipline = ? ORDER BY random() LIMIT 1",
                        AS_PASSAGE,
                        discipline.name())
                .stream()
                .findFirst();
    }

    Optional<Passage> findById(UUID id) {
        return jdbc.query("SELECT " + COLUMNS + " FROM passages WHERE id = ?", AS_PASSAGE, id).stream()
                .findFirst();
    }
}
