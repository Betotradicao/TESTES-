import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum WebhookLogStatus {
  OK = 'ok',
  REJECTED = 'rejected',
  ERROR = 'error'
}

export enum WebhookLogReason {
  SUCCESS = 'success',
  EAN_INVALID = 'ean_invalid',
  PRODUCT_NOT_FOUND = 'product_not_found',
  EQUIPMENT_DISABLED = 'equipment_disabled',
  EMPLOYEE_NOT_FOUND = 'employee_not_found',
  CANCELLATION_LIMIT = 'cancellation_limit',
  INTERNAL_ERROR = 'internal_error',
  EMPLOYEE_LOGIN = 'employee_login'
}

@Entity('webhook_logs')
export class WebhookLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  status: WebhookLogStatus;

  @Column({ type: 'varchar', length: 100 })
  reason: WebhookLogReason;

  @Column({ type: 'text', nullable: true })
  raw_payload: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ean: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  plu: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  product_description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  scanner_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  machine_id: string;

  @Column({ type: 'int', nullable: true })
  equipment_id: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  employee_name: string;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @Column({ type: 'int', nullable: true })
  bip_id: number;

  @CreateDateColumn()
  created_at: Date;
}
