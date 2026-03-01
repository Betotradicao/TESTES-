import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { GarimpadorContato } from './GarimpadorContato';

@Entity('garimpador_mensagens')
export class GarimpadorMensagem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  contato_id: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  remote_jid: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sender_name: string | null;

  @Column({ type: 'varchar', length: 20, default: 'texto' })
  tipo_midia: string; // 'texto' | 'imagem' | 'audio' | 'documento'

  @Column({ type: 'text', nullable: true })
  conteudo_original: string | null;

  @Column({ type: 'text', nullable: true })
  conteudo_extraido: string | null;

  @Column({ type: 'text', nullable: true })
  media_url: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  media_mimetype: string | null;

  @Column({ type: 'boolean', default: false })
  processado: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  message_id: string | null;

  @Column({ type: 'timestamp', nullable: true })
  received_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => GarimpadorContato, contato => contato.mensagens)
  @JoinColumn({ name: 'contato_id' })
  contato: GarimpadorContato;
}
