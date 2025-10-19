import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create temp directory for code execution
const TEMP_DIR = path.join(os.tmpdir(), 'cloudedge-code-exec');

// Ensure temp directory exists
async function ensureTempDir() {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
    } catch (error) {
        console.error('Failed to create temp directory:', error);
    }
}

ensureTempDir();

// Timeout for code execution (30 seconds)
const EXECUTION_TIMEOUT = 30000;

/**
 * Execute Python code
 */
export async function executePython(code, input = '') {
    const fileName = `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.py`;
    const filePath = path.join(TEMP_DIR, fileName);

    try {
        // Write code to file
        await fs.writeFile(filePath, code, 'utf8');

        // Execute with timeout
        const command = input
            ? `echo "${input.replace(/"/g, '\\"')}" | python3 "${filePath}"`
            : `python3 "${filePath}"`;

        const { stdout, stderr } = await execAsync(command, {
            timeout: EXECUTION_TIMEOUT,
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        });

        return {
            success: true,
            output: stdout,
            error: stderr,
            executionTime: Date.now(),
        };
    } catch (error) {
        return {
            success: false,
            output: error.stdout || '',
            error: error.stderr || error.message,
            executionTime: Date.now(),
        };
    } finally {
        // Cleanup
        try {
            await fs.unlink(filePath);
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

/**
 * Execute Java code
 */
export async function executeJava(code, className = 'Main', input = '') {
    const fileName = `${className}.java`;
    const filePath = path.join(TEMP_DIR, fileName);
    const classPath = TEMP_DIR;

    try {
        // Write code to file
        await fs.writeFile(filePath, code, 'utf8');

        // Compile
        const compileCommand = `javac "${filePath}"`;
        const { stderr: compileError } = await execAsync(compileCommand, {
            timeout: EXECUTION_TIMEOUT,
        });

        if (compileError) {
            return {
                success: false,
                output: '',
                error: `Compilation Error:\n${compileError}`,
                executionTime: Date.now(),
            };
        }

        // Execute
        const runCommand = input
            ? `echo "${input.replace(/"/g, '\\"')}" | java -cp "${classPath}" ${className}`
            : `java -cp "${classPath}" ${className}`;

        const { stdout, stderr } = await execAsync(runCommand, {
            timeout: EXECUTION_TIMEOUT,
            maxBuffer: 10 * 1024 * 1024,
        });

        return {
            success: true,
            output: stdout,
            error: stderr,
            executionTime: Date.now(),
        };
    } catch (error) {
        return {
            success: false,
            output: error.stdout || '',
            error: error.stderr || error.message,
            executionTime: Date.now(),
        };
    } finally {
        // Cleanup
        try {
            await fs.unlink(filePath);
            await fs.unlink(path.join(TEMP_DIR, `${className}.class`));
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

/**
 * Execute C/C++ code
 */
export async function executeCpp(code, language = 'cpp', input = '') {
    const ext = language === 'c' ? 'c' : 'cpp';
    const fileName = `program_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
    const filePath = path.join(TEMP_DIR, fileName);
    const outputPath = path.join(TEMP_DIR, `program_${Date.now()}`);

    try {
        // Write code to file
        await fs.writeFile(filePath, code, 'utf8');

        // Compile
        const compiler = language === 'c' ? 'gcc' : 'g++';
        const compileCommand = `${compiler} "${filePath}" -o "${outputPath}" -std=${language === 'c' ? 'c11' : 'c++17'}`;
        
        const { stderr: compileError } = await execAsync(compileCommand, {
            timeout: EXECUTION_TIMEOUT,
        });

        if (compileError && !compileError.includes('warning')) {
            return {
                success: false,
                output: '',
                error: `Compilation Error:\n${compileError}`,
                executionTime: Date.now(),
            };
        }

        // Execute
        const runCommand = input
            ? `echo "${input.replace(/"/g, '\\"')}" | "${outputPath}"`
            : `"${outputPath}"`;

        const { stdout, stderr } = await execAsync(runCommand, {
            timeout: EXECUTION_TIMEOUT,
            maxBuffer: 10 * 1024 * 1024,
        });

        return {
            success: true,
            output: stdout,
            error: stderr || compileError, // Include warnings
            executionTime: Date.now(),
        };
    } catch (error) {
        return {
            success: false,
            output: error.stdout || '',
            error: error.stderr || error.message,
            executionTime: Date.now(),
        };
    } finally {
        // Cleanup
        try {
            await fs.unlink(filePath);
            await fs.unlink(outputPath);
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

/**
 * Execute JavaScript/Node.js code
 */
export async function executeJavaScript(code, input = '') {
    const fileName = `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.js`;
    const filePath = path.join(TEMP_DIR, fileName);

    try {
        // Write code to file
        await fs.writeFile(filePath, code, 'utf8');

        // Execute
        const command = input
            ? `echo "${input.replace(/"/g, '\\"')}" | node "${filePath}"`
            : `node "${filePath}"`;

        const { stdout, stderr } = await execAsync(command, {
            timeout: EXECUTION_TIMEOUT,
            maxBuffer: 10 * 1024 * 1024,
        });

        return {
            success: true,
            output: stdout,
            error: stderr,
            executionTime: Date.now(),
        };
    } catch (error) {
        return {
            success: false,
            output: error.stdout || '',
            error: error.stderr || error.message,
            executionTime: Date.now(),
        };
    } finally {
        // Cleanup
        try {
            await fs.unlink(filePath);
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

/**
 * Install Python package
 */
export async function installPythonPackage(packageName) {
    try {
        const { stdout, stderr } = await execAsync(`pip3 install ${packageName}`, {
            timeout: 120000, // 2 minutes for installation
        });

        return {
            success: true,
            output: stdout,
            error: stderr,
        };
    } catch (error) {
        return {
            success: false,
            output: error.stdout || '',
            error: error.stderr || error.message,
        };
    }
}

/**
 * Check if required compilers/interpreters are installed
 */
export async function checkEnvironment() {
    const checks = {
        python: false,
        java: false,
        gcc: false,
        gpp: false,
        node: false,
    };

    try {
        await execAsync('python3 --version');
        checks.python = true;
    } catch (e) {
        // Python not available
    }

    try {
        await execAsync('javac -version');
        checks.java = true;
    } catch (e) {
        // Java not available
    }

    try {
        await execAsync('gcc --version');
        checks.gcc = true;
    } catch (e) {
        // GCC not available
    }

    try {
        await execAsync('g++ --version');
        checks.gpp = true;
    } catch (e) {
        // G++ not available
    }

    try {
        await execAsync('node --version');
        checks.node = true;
    } catch (e) {
        // Node not available
    }

    return checks;
}

/**
 * Clean up old temp files (older than 1 hour)
 */
export async function cleanupTempFiles() {
    try {
        const files = await fs.readdir(TEMP_DIR);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        for (const file of files) {
            const filePath = path.join(TEMP_DIR, file);
            const stats = await fs.stat(filePath);
            
            if (now - stats.mtimeMs > oneHour) {
                await fs.unlink(filePath);
            }
        }
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}

// Run cleanup every 30 minutes
setInterval(cleanupTempFiles, 30 * 60 * 1000);
