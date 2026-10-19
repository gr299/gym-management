import bcrypt from 'bcryptjs';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config } from '../src/config/env.js';
import { one, q } from '../src/config/db.js';
import { checkPasswordStrength } from '../src/controllers/authController.js';

function prompt(question, isPassword = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (!isPassword) {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    } else {
      process.stdout.write(question);
      let pass = '';
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      const onData = (char) => {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(pass.trim());
        } else if (char === '\u0003') {
          // Ctrl+C
          process.exit(1);
        } else if (char === '\b' || char === '\x7f') {
          if (pass.length > 0) {
            pass = pass.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          pass += char;
          process.stdout.write('*');
        }
      };

      process.stdin.on('data', onData);
    }
  });
}

export async function createAdminInteractive() {
  console.log('\n--- Create Initial Admin Account ---');
  const fullName = await prompt('Full Name: ');
  if (!fullName) {
    console.error('Full name is required.');
    process.exit(1);
  }

  const email = (await prompt('Email: ')).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    console.error('Valid email is required.');
    process.exit(1);
  }

  const existing = await one('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    console.error(`User with email "${email}" already exists.`);
    process.exit(1);
  }

  let password = await prompt('Password (min 8 chars, 1 letter, 1 number): ', true);
  const weakErr = checkPasswordStrength(password);
  if (weakErr) {
    console.error(`Weak password: ${weakErr}`);
    process.exit(1);
  }

  const confirm = await prompt('Confirm Password: ', true);
  if (password !== confirm) {
    console.error('Passwords do not match.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, config.bcryptRounds);
  const result = await q(
    "INSERT INTO users (full_name, email, password_hash, role, is_active) VALUES (?, ?, ?, 'admin', TRUE)",
    [fullName, email, hash]
  );

  console.log(`\nAdmin account created successfully! (User ID: ${result.insertId})`);
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createAdminInteractive().catch((err) => {
    console.error('Error creating admin:', err.message);
    process.exit(1);
  });
}

