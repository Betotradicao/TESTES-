import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('dvr_devices')
@Index(['codigo_loja'])
export class DvrDevice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'int' })
  codigo_loja: number;

  @Column({ length: 255 })
  ip: string;

  @Column({ type: 'int', default: 80 })
  porta_http: number;

  @Column({ type: 'int', default: 554 })
  porta_rtsp: number;

  @Column({ length: 100, nullable: true })
  usuario: string;

  @Column({ type: 'text', nullable: true })
  senha: string;

  @Column({ length: 20, default: 'transcode' })
  codec_mode: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  canais: { channel: number; pdv: number; label: string }[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  cameras_pdv: { channel: number; label: string; pdv: number; antes: number; depois: number }[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  cameras_bipagens: { channel: number; label: string; antes: number; depois: number }[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  cameras_risco: { channel: number; label: string; pdv: number; antes: number; depois: number }[];

  @Column({ type: 'int', default: 15 })
  antecedencia_segundos: number;

  @Column({ type: 'int', default: 120 })
  tempo_depois_segundos: number;

  @Column({ type: 'int', nullable: true })
  canal_padrao: number;

  @Column({ default: false })
  is_default: boolean;

  @Column({ length: 20, default: 'active' })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
