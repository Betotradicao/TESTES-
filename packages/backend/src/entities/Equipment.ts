import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Sector } from './Sector';

@Entity('equipments')
export class Equipment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 7, default: '#000000' })
  color_hash: string;

  @Column({ unique: true, length: 255 })
  scanner_machine_id: string;

  @Column({ length: 255 })
  machine_id: string;

  @Column({ length: 50, nullable: true })
  port_number?: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  sector_id: number;

  @ManyToOne(() => Sector, { nullable: true })
  @JoinColumn({ name: 'sector_id' })
  sector: Sector;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'int', nullable: true })
  cod_loja: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
