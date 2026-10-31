//! Bounded synchronous child output without pipes, for Linux sandboxes which
//! deny socket shutdown. The process remains inside the original sandbox.
import * as native from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

// Only the read-only Git and validation calls in this runtime use this helper.
// `prlimit` sets a hard per-file bound before exec and cannot raise privileges.
export function spawnSync(command: string, args: readonly string[], options: native.SpawnSyncOptionsWithStringEncoding): native.SpawnSyncReturns<string> {
  if (process.platform !== 'linux') return native.spawnSync(command, [...args], options);
  const max = options.maxBuffer ?? 1024 * 1024;
  if (!Number.isSafeInteger(max) || max < 0 || max > 64 * 1024 * 1024 || options.input != null || options.stdio != null || options.shell) throw new Error('Unsupported bounded process options');
  const env = options.env ?? process.env;
  const cwd = typeof options.cwd === 'string' ? options.cwd : options.cwd ? fileURLToPath(options.cwd) : process.cwd();
  const search = command.includes('/') ? [path.resolve(cwd, command)] : (env.PATH ?? '/usr/bin:/bin').split(':').map(dir => path.resolve(cwd, dir || '.', command));
  let candidate: string | undefined; let denied = false;
  for (const file of search) {
    try { fs.accessSync(file, fs.constants.X_OK); if (fs.statSync(file).isFile()) { candidate = file; break; } }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'EACCES') denied = true; }
  }
  if (!candidate) {
    const error = new Error(`spawnSync ${command} ${denied ? 'EACCES' : 'ENOENT'}`) as NodeJS.ErrnoException;
    error.code = denied ? 'EACCES' : 'ENOENT';
    return {pid: 0, output: [null, '', ''], stdout: '', stderr: '', status: null, signal: null, error};
  }
  const tmp = process.env.TMPDIR || os.tmpdir();
  const root = fs.mkdtempSync(path.join(tmp, '.birdview-io-'));
  let stdout: number | undefined, stderr: number | undefined;
  try {
    stdout = fs.openSync(path.join(root, 'stdout'), 'wx+', 0o600);
    stderr = fs.openSync(path.join(root, 'stderr'), 'wx+', 0o600);
    // Open descriptors stay valid, while unlinking now prevents data or files
    // remaining on disk after process termination or an uncatchable signal.
    fs.unlinkSync(path.join(root, 'stdout'));
    fs.unlinkSync(path.join(root, 'stderr'));
    fs.rmdirSync(root);
    const child = native.spawnSync('/usr/bin/prlimit', [`--fsize=${max + 1}:${max + 1}`, '--core=0:0', '--', candidate, ...args], {...options, timeout: options.timeout ?? 30000, killSignal: 'SIGKILL', stdio: ['ignore', stdout, stderr]});
    const read = (fd: number): {text: string, exceeded: boolean} => {
      const size = fs.fstatSync(fd).size;
      const bytes = Buffer.alloc(Math.min(size, max));
      let done = 0;
      while (done < bytes.length) { const n = fs.readSync(fd, bytes, done, bytes.length - done, done); if (!n) break; done += n; }
      return {text: bytes.subarray(0, done).toString(options.encoding), exceeded: size > max};
    };
    const out = read(stdout), err = read(stderr);
    child.stdout = out.text;
    child.stderr = err.text;
    child.output = [null, out.text, err.text];
    if (out.exceeded || err.exceeded || child.signal === 'SIGXFSZ') {
      const error = new Error('spawnSync maxBuffer exceeded') as NodeJS.ErrnoException;
      error.code = 'ENOBUFS';
      child.error = error;
      child.status = null;
    }
    return child;
  } finally {
    if (stdout !== undefined) fs.closeSync(stdout);
    if (stderr !== undefined) fs.closeSync(stderr);
    // Failures before unlinking must not leave private output behind.
    try { fs.unlinkSync(path.join(root, 'stdout')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    try { fs.unlinkSync(path.join(root, 'stderr')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    try { fs.rmdirSync(root); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
}
export function execFileSync(command: string, args: readonly string[], options: native.SpawnSyncOptionsWithStringEncoding): string {
  const child = spawnSync(command, args, options);
  if (child.error || child.status !== 0) {
    const error = child.error ?? new Error('Command failed');
    Object.assign(error, {status: child.status, signal: child.signal, stdout: child.stdout, stderr: child.stderr});
    throw error;
  }
  return child.stdout;
}
