/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * Seed default role-permission mapping for non-admin roles.
 *
 * Note:
 * - app_permission table and ADMIN permissions are already created
 *   in db-hardening-before-backend migration.
 * - This migration only adds permissions for operational roles.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`

    -- =========================================================
    -- QC Roles
    -- =========================================================

    INSERT INTO app_role_permission (role_id, permission_id)
    SELECT r.id, p.id
    FROM app_role r
    JOIN app_permission p
      ON p.permission_code IN ('QCInspection')
    WHERE r.role_code = 'INSPECTION_OPERATOR'
    ON CONFLICT (role_id, permission_id) DO NOTHING;


    INSERT INTO app_role_permission (role_id, permission_id)
    SELECT r.id, p.id
    FROM app_role r
    JOIN app_permission p
      ON p.permission_code IN ('QCInspection')
    WHERE r.role_code = 'INSPECTION_REVIEWER'
    ON CONFLICT (role_id, permission_id) DO NOTHING;


    INSERT INTO app_role_permission (role_id, permission_id)
    SELECT r.id, p.id
    FROM app_role r
    JOIN app_permission p
      ON p.permission_code IN ('QCInspection', 'ApproveQC')
    WHERE r.role_code = 'INSPECTION_APPROVER'
    ON CONFLICT (role_id, permission_id) DO NOTHING;


    -- =========================================================
    -- QA Roles
    -- =========================================================

    INSERT INTO app_role_permission (role_id, permission_id)
    SELECT r.id, p.id
    FROM app_role r
    JOIN app_permission p
      ON p.permission_code IN ('QASampling')
    WHERE r.role_code = 'QA_OPERATOR'
    ON CONFLICT (role_id, permission_id) DO NOTHING;


    INSERT INTO app_role_permission (role_id, permission_id)
    SELECT r.id, p.id
    FROM app_role r
    JOIN app_permission p
      ON p.permission_code IN ('QASampling')
    WHERE r.role_code = 'QA_REVIEWER'
    ON CONFLICT (role_id, permission_id) DO NOTHING;


    INSERT INTO app_role_permission (role_id, permission_id)
    SELECT r.id, p.id
    FROM app_role r
    JOIN app_permission p
      ON p.permission_code IN ('QASampling', 'ApproveQA')
    WHERE r.role_code = 'QA_APPROVER'
    ON CONFLICT (role_id, permission_id) DO NOTHING;


    -- =========================================================
    -- Viewer Role
    -- =========================================================

    INSERT INTO app_role_permission (role_id, permission_id)
    SELECT r.id, p.id
    FROM app_role r
    JOIN app_permission p
      ON p.permission_code IN ('SearchReport')
    WHERE r.role_code = 'VIEWER'
    ON CONFLICT (role_id, permission_id) DO NOTHING;

  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`

    DELETE FROM app_role_permission rp
    USING app_role r, app_permission p
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
      AND (
        (r.role_code = 'INSPECTION_OPERATOR' AND p.permission_code IN ('QCInspection'))
        OR
        (r.role_code = 'INSPECTION_REVIEWER' AND p.permission_code IN ('QCInspection'))
        OR
        (r.role_code = 'INSPECTION_APPROVER' AND p.permission_code IN ('QCInspection', 'ApproveQC'))
        OR
        (r.role_code = 'QA_OPERATOR' AND p.permission_code IN ('QASampling'))
        OR
        (r.role_code = 'QA_REVIEWER' AND p.permission_code IN ('QASampling'))
        OR
        (r.role_code = 'QA_APPROVER' AND p.permission_code IN ('QASampling', 'ApproveQA'))
        OR
        (r.role_code = 'VIEWER' AND p.permission_code IN ('SearchReport'))
      );

  `);
};