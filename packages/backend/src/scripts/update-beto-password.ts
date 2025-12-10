import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import bcrypt from 'bcrypt';

async function updateBetoPassword() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected');

    const userRepository = AppDataSource.getRepository(User);

    // Find the beto@master.com user
    const betoUser = await userRepository.findOne({
      where: { email: 'beto@master.com' }
    });

    if (!betoUser) {
      console.log('User beto@master.com not found');
      await AppDataSource.destroy();
      return;
    }

    // Update password (the BeforeUpdate hook will hash it automatically)
    const newPassword = 'Beto2025';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Direct update to avoid BeforeUpdate hook
    await userRepository.update(
      { email: 'beto@master.com' },
      { password: hashedPassword }
    );

    console.log('Password updated successfully for beto@master.com');
    console.log('You can now login with:');
    console.log('  Email: beto@master.com');
    console.log('  Password: Beto2025');

    await AppDataSource.destroy();
  } catch (error) {
    console.error('Error updating password:', error);
    process.exit(1);
  }
}

updateBetoPassword();
