const fs = require('fs');

let file = 'src/components/settings/SettingsUsersTab.tsx';
let content = fs.readFileSync(file, 'utf8');

const sIdx = content.indexOf('const handleSave = (e: React.FormEvent) => {');
const eIdx = content.indexOf('const columns: Column<SystemUser>[] = [', sIdx);

const newSave = `const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    if (editingUser) {
      updateUser(editingUser.id, {
        name: name.trim(),
        fullName: name.trim(),
        role,
        phone: phone.trim() || undefined
      });
    } else {
      addUser({
        name: name.trim(),
        fullName: name.trim(),
        email: email.trim(),
        role,
        status: 'Active',
        presenceStatus: 'Inactive',
        lastLogin: 'Never',
        phone: phone.trim() || undefined,
        accountStatus: 'Enabled'
      });
    }

    setIsModalOpen(false);
  };

  `;

content = content.slice(0, sIdx) + newSave + content.slice(eIdx);
fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated SettingsUsersTab.tsx handleSave');

