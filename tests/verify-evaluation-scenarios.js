/**
 * InterviewAI - AI Evaluation Pipeline Regression Test Suite
 * 
 * Tests the /api/ai/mock/evaluate endpoint with structured scenarios
 * to verify scoring accuracy and consistency.
 * 
 * Usage: node tests/verify-evaluation-scenarios.js
 * Requires: The Next.js dev server to be running on http://localhost:3000
 */

const EVAL_URL = "http://localhost:3000/api/ai/mock/evaluate";
const RATE_LIMIT_DELAY_MS = 65000; // 65s cooldown to respect Gemini free-tier 20 RPM

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const QUESTION_POLYMORPHISM = {
  question: "What is Polymorphism in Object-Oriented Programming?",
  idealAnswer: "Polymorphism allows objects of different classes to be treated as objects of a common superclass. It enables a single interface to represent different underlying forms (data types). The two main types are compile-time (method overloading) and runtime (method overriding via inheritance and virtual functions). Runtime polymorphism uses dynamic dispatch to determine which method implementation to invoke based on the actual object type at runtime.",
  keywords: ["polymorphism", "inheritance", "overriding", "overloading", "dynamic dispatch", "virtual", "interface", "abstract", "subclass"],
  concepts: ["compile-time polymorphism", "runtime polymorphism", "method overriding", "dynamic dispatch", "interface abstraction"],
  rubric: {
    beginner: "Mentions 'many forms' but cannot explain overriding vs overloading or give concrete examples.",
    intermediate: "Explains both types with examples but misses dynamic dispatch or virtual methods.",
    expert: "Provides a comprehensive explanation of both types, concrete code examples, and discusses vtable/dynamic dispatch."
  },
  difficulty: "Medium",
  modelAnswer: "Polymorphism is a core OOP principle meaning 'many forms.' There are two types: compile-time polymorphism (method overloading, where multiple methods share the same name but differ in parameters) and runtime polymorphism (method overriding, where a subclass provides a specific implementation of a method declared in its superclass). Runtime polymorphism uses dynamic dispatch — when you call a method on a base class reference, the JVM/runtime looks up the actual object's type in the vtable to determine which implementation to execute. This enables writing flexible, extensible code where new types can be added without modifying existing code."
};

async function runScenario(name, chatLog, expectedRange, shouldFail) {
  console.log(`\n--- Scenario ${name} ---`);
  
  try {
    const response = await fetch(EVAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "Software Engineer",
        round: "Technical",
        difficulty: "Medium",
        questions: [QUESTION_POLYMORPHISM, QUESTION_POLYMORPHISM, QUESTION_POLYMORPHISM],
        chatLog: chatLog,
        fillerWordsCount: 0
      })
    });

    const data = await response.json();

    if (shouldFail) {
      if (data.success === false) {
        console.log(`  ✅ PASS: Correctly returned evaluation failure.`);
        console.log(`  Error: ${data.error}: ${data.reason}`);
        return true;
      } else {
        console.log(`  ❌ FAIL: Expected evaluation failure, but got success with score ${data.evaluation?.readinessScore}%.`);
        return false;
      }
    }

    if (data.success === false) {
      console.log(`  ❌ FAIL: Expected success with score in [${expectedRange[0]}, ${expectedRange[1]}], got evaluation failure.`);
      console.log(`  Error: ${data.error}`);
      console.log(`  Reason: ${data.reason}`);
      if (data.validationErrors) console.log(`  ValidationErrors: ${JSON.stringify(data.validationErrors, null, 2)}`);
      if (data.errors) console.log(`  Errors: ${JSON.stringify(data.errors, null, 2)}`);
      if (data.value) console.log(`  Raw Value: ${JSON.stringify(data.value, null, 2)}`);
      return false;
    }

    const score = data.evaluation.readinessScore;
    const inRange = score >= expectedRange[0] && score <= expectedRange[1];
    
    if (inRange) {
      console.log(`  ✅ PASS: Score ${score}% is within expected range [${expectedRange[0]}%, ${expectedRange[1]}%].`);
    } else {
      console.log(`  ❌ FAIL: Score ${score}% is OUTSIDE expected range [${expectedRange[0]}%, ${expectedRange[1]}%].`);
    }

    // Log per-question scores
    if (data.evaluation.questionsReview) {
      for (const q of data.evaluation.questionsReview) {
        console.log(`    Q: "${q.question.substring(0, 60)}..." -> Overall: ${q.overall}%, Relevance: ${q.relevance}%, Tech: ${q.technical_accuracy}%`);
      }
    }

    return inRange;
  } catch (err) {
    console.log(`  ❌ ERROR: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log("============================================");
  console.log("InterviewAI Evaluation Regression Test Suite");
  console.log("============================================");

  let passed = 0;
  let failed = 0;
  const totalScenarios = 6;
  let current = 0;

  // Scenario A: Correct answer -> 85-100%
  const scenarioA = await runScenario(
    "A (Correct Answer → 85–100%)",
    [
      { sender: "ai", text: "Question 1: What is Polymorphism in Object-Oriented Programming?", timestamp: "10:00" },
      { sender: "user", text: "Polymorphism is a core OOP principle meaning many forms. There are two types: compile-time polymorphism through method overloading where multiple methods share the same name but differ in parameters, and runtime polymorphism through method overriding where a subclass provides a specific implementation of a method declared in its superclass. Runtime polymorphism uses dynamic dispatch — the runtime looks up the actual object type in the vtable to determine which implementation to execute. This enables flexible extensible code.", timestamp: "10:01" },
      { sender: "ai", text: "Question 2: What is Polymorphism in Object-Oriented Programming?", timestamp: "10:02" },
      { sender: "user", text: "Polymorphism allows objects of different classes to be treated through a common interface. Method overloading is compile-time polymorphism where you have multiple methods with the same name but different parameters. Method overriding is runtime polymorphism where a child class redefines a parent class method, and dynamic dispatch selects the correct implementation at runtime through a virtual method table.", timestamp: "10:03" },
      { sender: "ai", text: "Question 3: What is Polymorphism in Object-Oriented Programming?", timestamp: "10:04" },
      { sender: "user", text: "In OOP, polymorphism is the ability for a single interface to represent different data types. I use abstract classes and interfaces in Java to define contracts, then concrete subclasses implement specific behavior. The JVM uses the vtable for dynamic dispatch to call the right overridden method based on the runtime type of the object, not the reference type.", timestamp: "10:05" }
    ],
    [75, 100],
    false
  );
  scenarioA ? passed++ : failed++;
  current++;

  if (current < totalScenarios) {
    console.log(`\n⏳ Waiting ${RATE_LIMIT_DELAY_MS / 1000}s for API rate limit cooldown...`);
    await delay(RATE_LIMIT_DELAY_MS);
  }

  // Scenario B: Partial answer -> 50-70%
  const scenarioB = await runScenario(
    "B (Partial Answer → 40–75%)",
    [
      { sender: "ai", text: "Question 1: What is Polymorphism in Object-Oriented Programming?", timestamp: "10:00" },
      { sender: "user", text: "Polymorphism means many forms. It allows one method to behave differently depending on the object.", timestamp: "10:01" },
      { sender: "ai", text: "Question 2: What is Polymorphism in Object-Oriented Programming?", timestamp: "10:02" },
      { sender: "user", text: "It is when you override a method in a child class. Like a Dog class extending Animal class and overriding the speak method.", timestamp: "10:03" },
      { sender: "ai", text: "Question 3: What is Polymorphism in Object-Oriented Programming?", timestamp: "10:04" },
      { sender: "user", text: "Polymorphism is using inheritance to change behavior. You can have different implementations.", timestamp: "10:05" }
    ],
    [35, 75],
    false
  );
  scenarioB ? passed++ : failed++;
  current++;

  if (current < totalScenarios) {
    console.log(`\n⏳ Waiting ${RATE_LIMIT_DELAY_MS / 1000}s for API rate limit cooldown...`);
    await delay(RATE_LIMIT_DELAY_MS);
  }

  // Scenario C: Wrong answer -> 0-25%
  const scenarioC = await runScenario(
    "C (Wrong Answer → 0–25%)",
    [
      { sender: "ai", text: "Question 1: What is Polymorphism in Object-Oriented Programming?", timestamp: "10:00" },
      { sender: "user", text: "Polymorphism is a database indexing technique used to speed up SQL queries by creating B-tree structures on columns.", timestamp: "10:01" },
      { sender: "ai", text: "Question 2: What is Polymorphism in Object-Oriented Programming?", timestamp: "10:02" },
      { sender: "user", text: "Polymorphism is when you use Docker containers to deploy microservices on Kubernetes clusters with load balancing.", timestamp: "10:03" },
      { sender: "ai", text: "Question 3: What is Polymorphism in Object-Oriented Programming?", timestamp: "10:04" },
      { sender: "user", text: "It is a networking protocol used in TCP/IP for routing packets between subnets.", timestamp: "10:05" }
    ],
    [0, 25],
    false
  );
  scenarioC ? passed++ : failed++;
  current++;

  if (current < totalScenarios) {
    console.log(`\n⏳ Waiting ${RATE_LIMIT_DELAY_MS / 1000}s for API rate limit cooldown...`);
    await delay(RATE_LIMIT_DELAY_MS);
  }

  // Scenario D: Off-topic answer -> 0-10%
  const scenarioD = await runScenario(
    "D (Off-Topic Answer → 0–15%)",
    [
      { sender: "ai", text: "Question 1: What is Polymorphism in Object-Oriented Programming?", timestamp: "10:00" },
      { sender: "user", text: "I had pizza for lunch today and it was really delicious.", timestamp: "10:01" },
      { sender: "ai", text: "Question 2: What is Polymorphism in Object-Oriented Programming?", timestamp: "10:02" },
      { sender: "user", text: "The weather outside is nice and sunny. I like going for walks.", timestamp: "10:03" },
      { sender: "ai", text: "Question 3: What is Polymorphism in Object-Oriented Programming?", timestamp: "10:04" },
      { sender: "user", text: "My favorite movie is The Matrix. Have you seen it?", timestamp: "10:05" }
    ],
    [0, 15],
    false
  );
  scenarioD ? passed++ : failed++;
  current++;

  if (current < totalScenarios) {
    console.log(`\n⏳ Waiting ${RATE_LIMIT_DELAY_MS / 1000}s for API rate limit cooldown...`);
    await delay(RATE_LIMIT_DELAY_MS);
  }

  // Scenario E: No answer -> Evaluation Failed
  const scenarioE = await runScenario(
    "E (No Answer → Evaluation Failed)",
    [
      { sender: "ai", text: "Question 1: What is Polymorphism?", timestamp: "10:00" }
    ],
    null,
    true
  );
  scenarioE ? passed++ : failed++;
  current++;

  if (current < totalScenarios) {
    console.log(`\n⏳ Waiting ${RATE_LIMIT_DELAY_MS / 1000}s for API rate limit cooldown...`);
    await delay(RATE_LIMIT_DELAY_MS);
  }

  // Scenario F: Behavioral STAR answer -> High communication
  const scenarioF = await runScenario(
    "F (Behavioral STAR → High Relevance/Communication)",
    [
      { sender: "ai", text: "Question 1: What is Polymorphism in Object-Oriented Programming?", timestamp: "10:00" },
      { sender: "user", text: "In my previous role as a senior backend engineer, the Situation was that our codebase had deeply coupled payment processing logic. The Task was to refactor it for extensibility. My Action was to apply the Strategy pattern, which is a form of runtime polymorphism — I created a PaymentProcessor interface with process() method, then implemented CreditCardProcessor, PayPalProcessor, and CryptoProcessor subclasses. Each overrides process() with its own logic. The Result was a 40% reduction in code duplication and the ability to add new payment methods without touching existing code. This is polymorphism in action — dynamic dispatch selects the right implementation at runtime.", timestamp: "10:01" },
      { sender: "ai", text: "Question 2: What is Polymorphism in Object-Oriented Programming?", timestamp: "10:02" },
      { sender: "user", text: "Polymorphism allows treating different object types uniformly through a common interface. In my experience building a notification system, I defined a Notifier abstract class with a send() method. EmailNotifier, SMSNotifier, and PushNotifier each override send() with specific implementations. At runtime, the system uses dynamic dispatch to call the appropriate send() method based on the actual object type. This is runtime polymorphism. Compile-time polymorphism includes method overloading where multiple methods share names but differ in parameter signatures.", timestamp: "10:03" },
      { sender: "ai", text: "Question 3: What is Polymorphism in Object-Oriented Programming?", timestamp: "10:04" },
      { sender: "user", text: "Polymorphism is one of four OOP pillars. It means 'many forms' and enables a single interface to represent different types. Method overriding provides runtime polymorphism using vtables for dynamic method resolution. Method overloading provides compile-time polymorphism resolved by the compiler. I regularly use it with interfaces and abstract classes to design extensible systems following the Open/Closed Principle.", timestamp: "10:05" }
    ],
    [75, 100],
    false
  );
  scenarioF ? passed++ : failed++;

  // Summary
  console.log("\n============================================");
  console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} scenarios.`);
  console.log("============================================");
  
  if (failed > 0) {
    console.log("⚠️  Some scenarios did not match expected ranges. Review the LLM output above.");
    process.exit(1);
  } else {
    console.log("✅ All evaluation scenarios passed within expected ranges!");
    process.exit(0);
  }
}

main();
