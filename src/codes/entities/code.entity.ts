import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type CodeType = 'parent' | 'display' | 'product';

@Entity({ name: 'codes' })
@Index(['serial_number'], { unique: true })
@Index(['security_code'], { unique: true })
@Index(['orderId', 'type'])
export class CodeEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 32 })
  bag_number!: string;

  @Column({ type: 'varchar', length: 32 })
  serial_number!: string;

  @Column({ type: 'enum', enum: ['parent', 'display', 'product'] })
  type!: CodeType;

  @Column({ type: 'varchar', length: 32, nullable: true, default: null })
  parent_serial!: string | null;

  @Column({ type: 'varchar', length: 128 })
  security_code!: string;

  @Column({ type: 'boolean', default: false })
  verified!: boolean;

  @Column({ type: 'int', unsigned: true, default: 0 })
  count!: number;

  @Column({ type: 'varchar', length: 24, name: 'order_id' })
  orderId!: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;
}
