const bcrypt = require('bcrypt');

async function main() {
  const password = 'Admin@123';
  const saltRounds = 12;

  const hash = await bcrypt.hash(password, saltRounds);

  console.log('Password:', password);
  console.log('Hash:', hash);
}

main().catch(console.error);