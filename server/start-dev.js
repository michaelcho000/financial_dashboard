import { spawn } from 'child_process';

const processes = [];

const run = (command, args, name) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
  });
  processes.push(child);
  child.on('exit', code => {
    console.log(`${name} exited with code ${code}`);
    shutdown();
    process.exitCode = process.exitCode ?? code ?? 0;
  });
};

const shutdown = () => {
  processes.forEach(proc => {
    if (!proc.killed) {
      proc.kill('SIGINT');
    }
  });
};

process.on('SIGINT', () => {
  shutdown();
});

process.on('SIGTERM', () => {
  shutdown();
});

run('npm', ['run', 'server:only'], 'server');
run('npm', ['run', 'dev:only'], 'vite');
