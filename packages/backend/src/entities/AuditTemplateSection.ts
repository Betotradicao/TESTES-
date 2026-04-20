import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { AuditTemplate } from './AuditTemplate';
import { AuditTemplateQuestion } from './AuditTemplateQuestion';

@Entity('audit_template_sections')
export class AuditTemplateSection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'template_id' })
  template_id: number;

  @ManyToOne(() => AuditTemplate, t => t.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: AuditTemplate;

  @Column({ type: 'int', nullable: true })
  sector_id: number | null;

  @Column({ type: 'varchar', length: 255 })
  nome: string;

  @Column({ type: 'int', default: 0 })
  ordem: number;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => AuditTemplateQuestion, q => q.section)
  questions: AuditTemplateQuestion[];
}
