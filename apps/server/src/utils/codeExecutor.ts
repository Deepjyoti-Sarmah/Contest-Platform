// Simple mock code executor
// In production, you would integrate with Judge0, Docker, or other execution engine

interface TestCase {
  input: string;
  expectedOutput: string;
}

interface ExecutionResult {
  status: "accepted" | "wrong_answer" | "time_limit_exceeded" | "runtime_error";
  testCasesPassed: number;
  totalTestCases: number;
  executionTime: number;
}

export const executeCode = async (
  code: string,
  language: string,
  testCases: TestCase[],
  timeLimit: number,
): Promise<ExecutionResult> => {
  // Mock implementation - randomly pass/fail test cases for testing
  // Replace this with actual code execution logic (Judge0, Docker, etc.)

  try {
    const totalTestCases = testCases.length;

    // Simulate execution time
    const executionTime = Math.floor(Math.random() * timeLimit);

    // Simulate random test case results (for testing purposes)
    // In production, you would actually execute the code against test cases
    const passRate = Math.random();

    if (passRate < 0.1) {
      // 10% chance of runtime error
      return {
        status: "runtime_error",
        testCasesPassed: 0,
        totalTestCases,
        executionTime,
      };
    }

    if (passRate < 0.2) {
      // 10% chance of time limit exceeded
      return {
        status: "time_limit_exceeded",
        testCasesPassed: 0,
        totalTestCases,
        executionTime: timeLimit + 100,
      };
    }

    // Random number of passed test cases
    const testCasesPassed = Math.floor(Math.random() * (totalTestCases + 1));

    if (testCasesPassed === totalTestCases) {
      return {
        status: "accepted",
        testCasesPassed,
        totalTestCases,
        executionTime,
      };
    }

    return {
      status: "wrong_answer",
      testCasesPassed,
      totalTestCases,
      executionTime,
    };
  } catch (error) {
    return {
      status: "runtime_error",
      testCasesPassed: 0,
      totalTestCases: testCases.length,
      executionTime: 0,
    };
  }
};
