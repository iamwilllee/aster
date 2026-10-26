// Shared by Worker guards and the dependency-free local role CLI.
export const activeAdminCountSQL =
  '(SELECT COUNT(*) FROM admin_user AS roles JOIN user AS eligible ON eligible.id=roles.user_id LEFT JOIN account_access AS access ON access.user_id=roles.user_id WHERE eligible.email_verified=1 AND access.disabled_at IS NULL)'
