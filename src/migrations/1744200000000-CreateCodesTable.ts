import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateCodesTable1744200000000 implements MigrationInterface {
  name = 'CreateCodesTable1744200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'codes',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
            isNullable: false,
          },
          {
            name: 'bag_number',
            type: 'varchar',
            length: '32',
            isNullable: false,
          },
          {
            name: 'serial_number',
            type: 'varchar',
            length: '32',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['parent', 'display', 'product'],
            isNullable: false,
          },
          {
            name: 'parent_serial',
            type: 'varchar',
            length: '32',
            isNullable: true,
            default: null,
          },
          {
            name: 'security_code',
            type: 'varchar',
            length: '128',
            isNullable: false,
          },
          {
            name: 'verified',
            type: 'tinyint',
            width: 1,
            default: 0,
            isNullable: false,
          },
          {
            name: 'count',
            type: 'int',
            unsigned: true,
            default: 0,
            isNullable: false,
          },
          {
            name: 'order_id',
            type: 'varchar',
            length: '24',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'codes',
      new TableIndex({
        name: 'IDX_codes_serial_number_unique',
        columnNames: ['serial_number'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'codes',
      new TableIndex({
        name: 'IDX_codes_security_code_unique',
        columnNames: ['security_code'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'codes',
      new TableIndex({
        name: 'IDX_codes_order_id_type',
        columnNames: ['order_id', 'type'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('codes', 'IDX_codes_order_id_type');
    await queryRunner.dropIndex('codes', 'IDX_codes_security_code_unique');
    await queryRunner.dropIndex('codes', 'IDX_codes_serial_number_unique');
    await queryRunner.dropTable('codes');
  }
}
