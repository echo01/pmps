/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * Seed default admin user and ADMIN role assignment.
 *
 * Default dev password:
 * Admin@123
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`

    -- =========================================================
    -- Ensure ADMIN role exists
    -- app_role schema: role_code, role_name only
    -- =========================================================
    INSERT INTO app_role (
        role_code,
        role_name
    )
    VALUES (
        'ADMIN',
        'System Administrator'
    )
    ON CONFLICT (role_code) DO UPDATE
    SET
        role_name = EXCLUDED.role_name;


    -- =========================================================
    -- Seed admin user
    -- =========================================================
    INSERT INTO app_user (
        username,
        password_hash,
        employee_code,
        full_name,
        email,
        active,
        failed_login_count,
        created_at
    )
    VALUES (
        'admin',
        '$2b$12$S.8y3omKRguxrUa6RlqwWeBua8iTzSvF0JfNlpHmYcvoI.tJWY1f2',
        'ADMIN001',
        'System Administrator',
        'admin@example.com',
        true,
        0,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (username) DO UPDATE
    SET
        password_hash = EXCLUDED.password_hash,
        employee_code = EXCLUDED.employee_code,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        active = true,
        failed_login_count = 0;


    -- =========================================================
    -- Assign ADMIN role to admin user
    -- =========================================================
    INSERT INTO app_user_role (
        user_id,
        role_id
    )
    SELECT u.id, r.id
    FROM app_user u
    JOIN app_role r ON r.role_code = 'ADMIN'
    WHERE u.username = 'admin'
    ON CONFLICT (user_id, role_id) DO NOTHING;

  `);
};

/**
 * Rollback only admin seed data.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`

    DELETE FROM app_user_role ur
    USING app_user u, app_role r
    WHERE ur.user_id = u.id
      AND ur.role_id = r.id
      AND u.username = 'admin'
      AND r.role_code = 'ADMIN';

    DELETE FROM app_user
    WHERE username = 'admin';

  `);
};