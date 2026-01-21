import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('email_monitor_logs')
export class EmailMonitorLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  email_subject: string;

  @Column({ type: 'varchar', length: 255 })
  sender: string;

  @Column({ type: 'text', nullable: true })
  email_body: string | null;

  @Column({ type: 'varchar', length: 100 })
  status: string; // 'success', 'error', 'skipped', 'partial' (WhatsApp enviado mas sem imagem na galeria)

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'boolean', default: false })
  has_attachment: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  whatsapp_group_id: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image_path: string | null;

  @CreateDateColumn()
  processed_at: Date;
}
