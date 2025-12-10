import 'reflect-metadata';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';

const createUser = async () => {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.error('Usage: npm run create-user <email> <password>');
    process.exit(1);
  }

  const [email, password] = args;

  try {
    await AppDataSource.initialize();

    const userRepository = AppDataSource.getRepository(User);

    const existingUser = await userRepository.findOne({ where: { email } });
    if (existingUser) {
      console.error('Error: User with this email already exists');
      process.exit(1);
    }

    const user = userRepository.create({
      email,
      password
    });

    await userRepository.save(user);

    console.log(`User created successfully:`);
    console.log(`- Email: ${email}`);
    console.log(`- ID: ${user.id}`);

    process.exit(0);
  } catch (error) {
    console.error('Error creating user:', error);
    process.exit(1);
  }
};

createUser();