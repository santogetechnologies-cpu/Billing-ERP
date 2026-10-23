import { authService } from '../src/services/authService';
import { getRoleDefaultRoute } from '../src/utils/rbac';

async function testLoginRoles() {
  console.log('Testing Salesperson Login:');
  const salesRes = await authService.signIn('sales@gmail.com', 'sales123');
  console.log('salesRes user:', salesRes.data?.user?.email);
  console.log('salesRes user metadata role:', salesRes.data?.user?.user_metadata?.role);
  const salesProf = await authService.getCurrentUserProfile(salesRes.data?.user?.id);
  console.log('salesProf role:', salesProf?.role);
  console.log('sales default route:', getRoleDefaultRoute(salesProf?.role || salesRes.data?.user?.user_metadata?.role));

  console.log('\nTesting Owner Login:');
  const ownerRes = await authService.signIn('owner@gmail.com', 'owner123');
  console.log('ownerRes user:', ownerRes.data?.user?.email);
  console.log('ownerRes user metadata role:', ownerRes.data?.user?.user_metadata?.role);
  const ownerProf = await authService.getCurrentUserProfile(ownerRes.data?.user?.id);
  console.log('ownerProf role:', ownerProf?.role);
  console.log('owner default route:', getRoleDefaultRoute(ownerProf?.role || ownerRes.data?.user?.user_metadata?.role));

  console.log('\nTesting Admin Login:');
  const adminRes = await authService.signIn('admin@gmail.com', 'admin123');
  console.log('adminRes user:', adminRes.data?.user?.email);
  console.log('adminRes user metadata role:', adminRes.data?.user?.user_metadata?.role);
  const adminProf = await authService.getCurrentUserProfile(adminRes.data?.user?.id);
  console.log('adminProf role:', adminProf?.role);
  console.log('admin default route:', getRoleDefaultRoute(adminProf?.role || adminRes.data?.user?.user_metadata?.role));

  console.log('\nTesting Purchase Manager Login:');
  const pmRes = await authService.signIn('purchase@gmail.com', 'purchase123');
  console.log('pmRes success:', !pmRes.error);
  console.log('pmRes user:', pmRes.data?.user?.email);
  console.log('pmRes user metadata role:', pmRes.data?.user?.user_metadata?.role);
  const pmProf = await authService.getCurrentUserProfile(pmRes.data?.user?.id);
  console.log('pmProf role:', pmProf?.role);
  console.log('pm default route:', getRoleDefaultRoute(pmProf?.role || pmRes.data?.user?.user_metadata?.role));
}

testLoginRoles().catch(console.error);
