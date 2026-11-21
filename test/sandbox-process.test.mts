import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from '../src/sandbox-process.mjs';

test('bounded child output preserves error and exit semantics', {skip:process.platform !== 'linux'}, () => {
  const ok=spawnSync('git',['--version'],{encoding:'utf8'}); assert.equal(ok.status,0); assert.match(ok.stdout,/git version/);
  const missing=spawnSync('/no-such-birdview-command',[],{encoding:'utf8'}); assert.equal((missing.error as NodeJS.ErrnoException | undefined)?.code,'ENOENT');
  const fail=spawnSync(process.execPath,['-e',`const fs=require('fs');fs.writeSync(1,'out');fs.writeSync(2,'err');process.exit(42)`],{encoding:'utf8'});
  assert.equal(fail.status,42);assert.equal(fail.stdout,'out');assert.equal(fail.stderr,'err');assert.deepEqual(fail.output,[null,'out','err']);
  for(const fd of [1,2]) {
    const result=spawnSync(process.execPath,['-e',`try {require('fs').writeSync(${fd},Buffer.alloc(65536,65))}catch{};process.exit(0)`],{encoding:'utf8',maxBuffer:1024});
    assert.equal((result.error as NodeJS.ErrnoException | undefined)?.code,'ENOBUFS');assert.equal(result.status,null);
    assert.equal((fd===1?result.stdout:result.stderr).length,1024);
  }
  const timed=spawnSync('/usr/bin/sleep',['10'],{encoding:'utf8',timeout:250});assert.equal((timed.error as NodeJS.ErrnoException | undefined)?.code,'ETIMEDOUT');
  assert.throws(()=>spawnSync(process.execPath,[],{encoding:'utf8',input:'secret'}),/Unsupported/);
});

test('private output files are removed on normal completion', {skip:process.platform !== 'linux'}, () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'birdview-io-test-'));
  const previous=process.env.TMPDIR;
  try { process.env.TMPDIR=root; assert.equal(spawnSync('git',['--version'],{encoding:'utf8'}).status,0);assert.deepEqual(fs.readdirSync(root),[]); }
  finally { if(previous===undefined)delete process.env.TMPDIR; else process.env.TMPDIR=previous;fs.rmSync(root,{recursive:true,force:true}); }
});

test('relative executable and PATH resolution use the child cwd', {skip:process.platform !== 'linux'}, () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'birdview-path-test-'));
  try {
    fs.mkdirSync(path.join(root,'bin'));
    const executable=path.join(root,'bin/probe');
    fs.writeFileSync(executable,'#!/bin/sh\nprintf cwd-ok\n',{mode:0o755});
    for(const command of ['probe','./bin/probe']) {
      const result=spawnSync(command,[],{encoding:'utf8',cwd:root,env:{...process.env,PATH:'bin'}});
      assert.equal(result.status,0,result.error?.message);assert.equal(result.stdout,'cwd-ok');
    }
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
