/// <reference path="./bun-types.d.ts" />
import { describe, test, expect, beforeAll } from "bun:test";
import { readdir, readFile, mkdir, copyFile, stat, rm, mkdtemp } from "fs/promises";
import { resolve, join } from "path";

// Type augmentation for Bun's import.meta.dir and Bun global
declare interface ImportMeta {
  dir?: string;
}

declare global {
  var Bun: {
    spawn(args: string[], options?: { 
      cwd?: string;
      stdout?: "pipe" | "inherit" | "ignore";
      stderr?: "pipe" | "inherit" | "ignore";
      env?: Record<string, string>;
    }): {
      exited: Promise<number>;
      stdout: ReadableStream;
      stderr: ReadableStream;
      pid: number;
      kill(code?: number): void;
    };
    env: Record<string, string | undefined>;
  };
}

// Get the directory containing this test file
const testFileDir = import.meta.dir!;
// Go up from suites/next.js/ to project root
const rootDir = resolve(testFileDir, "../..");
const suitesDir = join(rootDir, "suites", "next.js");
const scenariosDir = join(suitesDir, "scenarios");
const promptsDir = join(suitesDir, "prompts");
const evalsDir = join(rootDir, "evals");

interface ScenarioConfig {
  id: string;
  suite: string;
  title: string;
  description: string;
  workspace: {
    node: string;
    manager: string;
    managers_allowed?: string[];
    workspaces?: string;
  };
  baseline: {
    run: Array<{ cmd: string }>;
  };
  validation: {
    commands: {
      install: string;
      test: string;
      lint: string;
    };
  };
}

async function getAllScenarios(): Promise<string[]> {
  const entries = await readdir(scenariosDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function findOutputDirectories(evalName: string): Promise<string[]> {
  const evalDir = join(evalsDir, evalName);
  const entries = await readdir(evalDir, { withFileTypes: true });
  
  const outputDirs: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith("output-")) {
      outputDirs.push(join(evalDir, entry.name));
    }
  }
  
  return outputDirs;
}

async function readScenarioYaml(
  scenarioName: string
): Promise<ScenarioConfig | null> {
  const yamlPath = join(scenariosDir, scenarioName, "scenario.yaml");
  try {
    const content = await readFile(yamlPath, "utf-8");
    // Simple YAML parsing - enough for our validation needs
    const lines = content.split("\n");
    const config: Partial<ScenarioConfig> = {};

    let currentSection = "";
    let inDescription = false;
    let descriptionLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith("#")) continue;

      if (line === "workspace:") {
        currentSection = "workspace";
        config.workspace = { node: "", manager: "" };
        continue;
      }
      if (line === "baseline:") {
        currentSection = "baseline";
        config.baseline = { run: [] };
        continue;
      }
      if (line === "validation:") {
        currentSection = "validation";
        config.validation = { commands: { install: "", test: "", lint: "" } };
        continue;
      }
      if (line === "description: |") {
        inDescription = true;
        continue;
      }
      if (inDescription && line.startsWith("  ")) {
        descriptionLines.push(line.substring(2));
        continue;
      }
      if (inDescription && !line.startsWith("  ")) {
        inDescription = false;
        config.description = descriptionLines.join("\n").trim();
        descriptionLines = [];
      }

      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) continue;

      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      value = value.replace(/^["']|["']$/g, ""); // Remove quotes

      if (currentSection === "workspace") {
        if (key === "node") config.workspace!.node = value;
        if (key === "manager") config.workspace!.manager = value;
        if (key === "managers_allowed") {
          const match = value.match(/\[(.*?)\]/);
          config.workspace!.managers_allowed = match
            ? match[1].split(",").map((s) => s.trim())
            : [];
        }
        if (key === "workspaces") config.workspace!.workspaces = value;
      } else if (currentSection === "baseline" && key === "run") {
        // Handle cmd lines
        const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
        if (nextLine.includes('cmd:')) {
          const cmdMatch = nextLine.match(/cmd:\s*"(.*)"/);
          if (cmdMatch) {
            config.baseline!.run.push({ cmd: cmdMatch[1] });
            i++; // Skip the cmd line
          }
        }
      } else if (currentSection === "validation") {
        if (key === "install")
          config.validation!.commands.install = value.replace(/^["']|["']$/g, "");
        if (key === "test")
          config.validation!.commands.test = value.replace(/^["']|["']$/g, "");
        if (key === "lint")
          config.validation!.commands.lint = value.replace(/^["']|["']$/g, "");
      } else {
        if (key === "id") config.id = value;
        if (key === "suite") config.suite = value;
        if (key === "title") config.title = value;
      }
    }

    if (inDescription && descriptionLines.length > 0) {
      config.description = descriptionLines.join("\n").trim();
    }

    return config as ScenarioConfig;
  } catch (error) {
    console.error(`Failed to parse scenario.yaml for ${scenarioName}:`, error);
    return null;
  }
}

async function runCommand(
  command: string,
  cwd: string,
  timeout: number = 600000
): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    const [cmd, ...args] = command.split(" ");
    const proc = Bun.spawn([cmd, ...args], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...Bun.env },
    });

    let stdout = "";
    let stderr = "";

    // Read from streams using ReadableStream API
    const readStream = async (stream: ReadableStream<Uint8Array> | undefined, output: { value: string }) => {
      if (!stream) return;
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          output.value += decoder.decode(value, { stream: true });
        }
        // Decode any remaining data
        output.value += decoder.decode();
      } catch (error) {
        // Ignore read errors
      } finally {
        reader.releaseLock();
      }
    };

    // Start reading both streams concurrently
    const stdoutObj = { value: stdout };
    const stderrObj = { value: stderr };
    readStream(proc.stdout, stdoutObj);
    readStream(proc.stderr, stderrObj);

    const timer = setTimeout(() => {
      proc.kill();
      resolve({
        success: false,
        output: stdoutObj.value,
        error: `Command timed out after ${timeout}ms`,
      });
    }, timeout);

    proc.exited.then(async (code) => {
      clearTimeout(timer);
      // Ensure all stream data is read
      await readStream(proc.stdout, stdoutObj);
      await readStream(proc.stderr, stderrObj);
      resolve({
        success: code === 0,
        output: stdoutObj.value + (stderrObj.value ? `\n${stderrObj.value}` : ""),
        error: code !== 0 ? `Exit code: ${code}` : undefined,
      });
    });
  });
}

async function copyDirectory(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules") {
      continue;
    }

    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

describe("Next.js Scenarios", () => {
  let scenarios: string[] = [];

  beforeAll(async () => {
    scenarios = await getAllScenarios();
    expect(scenarios.length).toBeGreaterThan(0);
  });

  describe("Structure Tests", () => {
    test("should have 50 scenario directories", () => {
      expect(scenarios.length).toBe(50);
    });

    test.each(scenarios)("should have required files for %s", async (scenarioName: string) => {
      const scenarioDir = join(scenariosDir, scenarioName);
      const scenarioYamlPath = join(scenarioDir, "scenario.yaml");
      const repoFixturePath = join(scenarioDir, "repo-fixture");
      const oracleAnswersPath = join(scenarioDir, "oracle-answers.json");
      const promptPath = join(
        promptsDir,
        scenarioName,
        "L1-basic.md"
      );
      const promptPathL3 = join(
        promptsDir,
        scenarioName,
        "L3-migration.md"
      );

      // Check scenario.yaml exists
      const hasYaml = await stat(scenarioYamlPath)
        .then(() => true)
        .catch(() => false);
      expect(hasYaml).toBe(true);

      // Check repo-fixture exists and is a directory
      const fixtureStat = await stat(repoFixturePath)
        .then((s) => s.isDirectory())
        .catch(() => false);
      expect(fixtureStat).toBe(true);

      // Check oracle-answers.json exists
      const hasOracle = await stat(oracleAnswersPath)
        .then(() => true)
        .catch(() => false);
      expect(hasOracle).toBe(true);

      // Check prompt file exists (either L1 or L3)
      const hasPromptL1 = await stat(promptPath)
        .then(() => true)
        .catch(() => false);
      const hasPromptL3 = await stat(promptPathL3)
        .then(() => true)
        .catch(() => false);
      expect(hasPromptL1 || hasPromptL3).toBe(true);
    });
  });

  describe("Scenario Configuration Tests", () => {
    test.each(scenarios)(
      "should have valid scenario.yaml for %s",
      async (scenarioName) => {
        const config = await readScenarioYaml(scenarioName);
        expect(config).not.toBeNull();
        expect(config!.id).toMatch(/^ZE_nextjs_/);
        expect(config!.suite).toBe("next.js");
        expect(config!.title).toBeTruthy();
        expect(config!.description).toBeTruthy();
        expect(config!.workspace.node).toMatch(/^\d+\.x$/);
        expect(config!.workspace.manager).toBeTruthy();
        expect(config!.baseline.run.length).toBeGreaterThan(0);
        expect(config!.validation.commands.install).toBeTruthy();
        expect(config!.validation.commands.test).toBeTruthy();
        expect(config!.validation.commands.lint).toBeTruthy();
      }
    );
  });

  describe("Repo Fixture Tests", () => {
    test.each(scenarios)(
      "should have valid repo-fixture for %s",
      async (scenarioName) => {
        const repoFixtureDir = join(
          scenariosDir,
          scenarioName,
          "repo-fixture"
        );
        const packageJsonPath = join(repoFixtureDir, "package.json");
        const pnpmLockPath = join(repoFixtureDir, "pnpm-lock.yaml");

        // Check package.json exists
        const hasPackageJson = await stat(packageJsonPath)
          .then(() => true)
          .catch(() => false);
        expect(hasPackageJson).toBe(true);

        // Read package.json
        const packageJsonContent = await readFile(
          packageJsonPath,
          "utf-8"
        );
        const packageJson = JSON.parse(packageJsonContent);

        // Check for Next.js
        expect(packageJson.dependencies?.next || packageJson.devDependencies?.next).toBeTruthy();

        // Check scripts
        expect(packageJson.scripts?.build).toBeTruthy();
        expect(packageJson.scripts?.test).toBeTruthy();

        // Check pnpm-lock.yaml exists
        const hasPnpmLock = await stat(pnpmLockPath)
          .then(() => true)
          .catch(() => false);
        expect(hasPnpmLock).toBe(true);
      }
    );
  });

  describe("Output Directory Validation Tests", () => {
    // Test each scenario using its output directories as expected solutions
    test.each(scenarios)(
      "should validate output directories for %s",
      async (scenarioName) => {
        const evalName = scenarioName;
        const outputDirs = await findOutputDirectories(evalName);
        
        // Skip if no output directories exist
        if (outputDirs.length === 0) {
          console.log(`⚠️  No output directories found for ${evalName}, skipping`);
          return;
        }

        const config = await readScenarioYaml(scenarioName);
        if (!config) {
          throw new Error(`Failed to read config for ${scenarioName}`);
        }

        // Test each output directory
        for (const outputDir of outputDirs) {
          const outputDirName = outputDir.split(/[/\\]/).pop() || "unknown";
          
          // Create temporary directory
          const tempDir = await mkdtemp(
            join(Bun.env.TMPDIR || Bun.env.TEMP || "/tmp", `nextjs-output-test-${evalName}-${outputDirName}-`)
          );

          try {
            // Copy output directory to temp directory
            await copyDirectory(outputDir, tempDir);

            // Run validation commands
            console.log(`  Testing ${outputDirName} for ${evalName}...`);

            // Install dependencies
            const installResult = await runCommand(
              config.validation.commands.install,
              tempDir,
              600000
            );
            
            if (!installResult.success) {
              console.error(`    ❌ Install failed for ${outputDirName}: ${installResult.error}`);
              console.error(`    Output: ${installResult.output}`);
            }
            expect(installResult.success).toBe(true);

            // Run build (if it exists, some scenarios might not have build in validation)
            // But we should at least try to verify it can build
            const packageJsonPath = join(tempDir, "package.json");
            const packageJsonContent = await readFile(packageJsonPath, "utf-8");
            const packageJson = JSON.parse(packageJsonContent);
            
            if (packageJson.scripts?.build) {
              const buildCmd = "pnpm build";
              const buildResult = await runCommand(buildCmd, tempDir, 300000);
              if (!buildResult.success) {
                console.error(`    ❌ Build failed for ${outputDirName}: ${buildResult.error}`);
                console.error(`    Output: ${buildResult.output}`);
              }
              expect(buildResult.success).toBe(true);
            }

            // Run lint
            if (packageJson.scripts?.lint) {
              const lintResult = await runCommand(
                config.validation.commands.lint,
                tempDir,
                120000
              );
              if (!lintResult.success) {
                console.error(`    ⚠️  Lint failed for ${outputDirName} (non-fatal): ${lintResult.error}`);
                // Lint failures are warnings, not test failures
              }
            }

            // Run tests
            if (packageJson.scripts?.test) {
              const testResult = await runCommand(
                config.validation.commands.test,
                tempDir,
                300000
              );
              if (!testResult.success) {
                console.error(`    ❌ Tests failed for ${outputDirName}: ${testResult.error}`);
                console.error(`    Output: ${testResult.output}`);
              }
              expect(testResult.success).toBe(true);
            }

            console.log(`    ✅ ${outputDirName} passed all validations`);
          } catch (error) {
            console.error(`    ❌ Error testing ${outputDirName}:`, error);
            throw error;
          } finally {
            // Clean up temp directory
            try {
              await rm(tempDir, { recursive: true, force: true });
            } catch {
              // Ignore cleanup errors
            }
          }
        }
      },
      1200000 // 20 minute timeout per scenario (allows time for multiple output dirs)
    );
  });

  describe("Next.js Specific Tests", () => {
    test.each(scenarios)(
      "should be a valid Next.js project for %s",
      async (scenarioName) => {
        const repoFixtureDir = join(
          scenariosDir,
          scenarioName,
          "repo-fixture"
        );
        const packageJsonPath = join(repoFixtureDir, "package.json");

        const packageJsonContent = await readFile(
          packageJsonPath,
          "utf-8"
        );
        const packageJson = JSON.parse(packageJsonContent);

        // Check Next.js is in dependencies
        const hasNext =
          packageJson.dependencies?.next ||
          packageJson.devDependencies?.next;
        expect(hasNext).toBeTruthy();

        // Check for Next.js config file
        const nextConfigTs = join(repoFixtureDir, "next.config.ts");
        const nextConfigJs = join(repoFixtureDir, "next.config.js");
        const nextConfigMjs = join(repoFixtureDir, "next.config.mjs");

        const hasNextConfig =
          (await stat(nextConfigTs).then(() => true).catch(() => false)) ||
          (await stat(nextConfigJs).then(() => true).catch(() => false)) ||
          (await stat(nextConfigMjs).then(() => true).catch(() => false));

        expect(hasNextConfig).toBe(true);

        // Check for app or pages directory
        const appDir = join(repoFixtureDir, "app");
        const pagesDir = join(repoFixtureDir, "pages");

        const hasAppDir = await stat(appDir)
          .then((s) => s.isDirectory())
          .catch(() => false);
        const hasPagesDir = await stat(pagesDir)
          .then((s) => s.isDirectory())
          .catch(() => false);

        expect(hasAppDir || hasPagesDir).toBe(true);
      }
    );
  });

  describe("Prompt Tests", () => {
    test.each(scenarios)("should have valid prompt for %s", async (scenarioName) => {
      const promptPathL1 = join(
        promptsDir,
        scenarioName,
        "L1-basic.md"
      );
      const promptPathL3 = join(
        promptsDir,
        scenarioName,
        "L3-migration.md"
      );

      const hasL1 = await stat(promptPathL1)
        .then(() => true)
        .catch(() => false);
      const hasL3 = await stat(promptPathL3)
        .then(() => true)
        .catch(() => false);

      expect(hasL1 || hasL3).toBe(true);

      // Check prompt is non-empty
      const promptPath = hasL3 ? promptPathL3 : promptPathL1;
      const promptContent = await readFile(promptPath, "utf-8");
      expect(promptContent.trim().length).toBeGreaterThan(0);
    });
  });
});