package dev.markdsouza.godmodecode.pattern;

import dev.markdsouza.godmodecode.AbstractIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * The application, driven through HTTP, with a judge that answers.
 *
 * The rest of the suite points the backend at a port that refuses immediately,
 * because "the judge is down and only the Code Discipline notices" is a claim
 * worth making. These tests are about the Code Discipline itself, so they need
 * something on the other end — but still not a real judge: a container runtime
 * and ten seconds of Python have nothing to say about whether a Solve Run is
 * verified, recorded and attributed correctly.
 */
public abstract class JudgedIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void pointAtTheStubJudge(DynamicPropertyRegistry registry) {
        registry.add("gmc.judge.base-url", StubJudge::baseUrl);
    }

    @AfterEach
    void forgetWhatTheJudgeWasTold() {
        StubJudge.reset();
    }
}
