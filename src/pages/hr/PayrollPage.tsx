import React, { useState, useMemo } from 'react';
import {
  Users,
  Calendar,
  DollarSign,
  Plus,
  Check,
  CheckCircle2,
  X,
  Clock,
  Printer,
  Download,
  AlertCircle,
  FileText,
  Building,
  UserCheck,
  Briefcase,
  CreditCard,
  HandCoins
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { StaffMember, AttendanceStatus, AttendanceRecord, LeaveRequest, PayrollRun, Payslip, StaffAdvanceRecord } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { DataTable, Column } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { exportToCSV } from '../../utils/exportUtils';
import { Tabs, TabItem } from '../../components/common/Tabs';

export const PayrollPage: React.FC = () => {
  const {
    staffMembers,
    addStaffMember,
    updateStaffMember,
    attendanceRecords,
    markAttendance,
    getStaffAttendanceForMonth,
    leaveRequests,
    submitLeaveRequest,
    updateLeaveStatus,
    payrollRuns,
    payslips,
    runPayroll,
    company,
    staffAdvances = [],
    recordStaffAdvance
  } = useERP();

  const [activeTab, setActiveTab] = useState<'staff' | 'attendance' | 'leaves' | 'payroll' | 'advances'>('staff');

  // =========================================================================
  // TAB 1: STAFF DIRECTORY
  // =========================================================================
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [role, setRole] = useState('Salesperson');
  const [department, setDepartment] = useState('Sales');
  const [phone, setPhone] = useState('');
  const [employmentType, setEmploymentType] = useState<StaffMember['employmentType']>('Full Time');
  const [salaryType, setSalaryType] = useState<StaffMember['salaryType']>('Monthly');
  const [baseSalary, setBaseSalary] = useState('');
  const [allowedCasualLeaves, setAllowedCasualLeaves] = useState('12');
  const [allowedSickLeaves, setAllowedSickLeaves] = useState('8');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');

  const handleOpenAddStaff = () => {
    setEditingStaff(null);
    setName('');
    setCode(`EMP-${Date.now().toString().slice(-4)}`);
    setRole('Salesperson & Delivery');
    setDepartment('Sales & Dispatch');
    setPhone('');
    setEmploymentType('Full Time');
    setSalaryType('Monthly');
    setBaseSalary('18000');
    setAllowedCasualLeaves('12');
    setAllowedSickLeaves('8');
    setBankName('');
    setAccountNumber('');
    setIfsc('');
    setIsStaffModalOpen(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      code: code.trim() || `EMP-${Date.now().toString().slice(-4)}`,
      role: role.trim(),
      department: department.trim(),
      phone: phone.trim(),
      employmentType,
      salaryType,
      baseSalary: parseFloat(baseSalary) || 0,
      joinDate: new Date().toISOString().split('T')[0],
      status: 'Active' as const,
      allowedCasualLeaves: parseInt(allowedCasualLeaves) || 12,
      allowedSickLeaves: parseInt(allowedSickLeaves) || 8,
      bankAccount: bankName.trim() ? {
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        ifsc: ifsc.trim()
      } : undefined
    };

    if (editingStaff) {
      await updateStaffMember(editingStaff.id, payload);
    } else {
      await addStaffMember(payload);
    }

    setIsStaffModalOpen(false);
  };

  // =========================================================================
  // TAB 2: DAILY ATTENDANCE
  // =========================================================================
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: AttendanceStatus; overtimeHours?: number }>>({});
  const [attendanceSavedMsg, setAttendanceSavedMsg] = useState(false);

  // Initialize today's attendance map from existing records
  useMemo(() => {
    const map: Record<string, { status: AttendanceStatus; overtimeHours?: number }> = {};
    staffMembers.forEach(s => {
      const rec = attendanceRecords.find(r => r.staffId === s.id && r.date === selectedDate);
      map[s.id] = {
        status: rec?.status || 'Present',
        overtimeHours: rec?.overtimeHours || 0
      };
    });
    setAttendanceMap(map);
  }, [staffMembers, attendanceRecords, selectedDate]);

  const handleMarkAllPresent = () => {
    const next: Record<string, { status: AttendanceStatus; overtimeHours?: number }> = {};
    staffMembers.forEach(s => {
      next[s.id] = { status: 'Present', overtimeHours: 0 };
    });
    setAttendanceMap(next);
  };

  const handleSaveAttendance = async () => {
    const records = staffMembers.map(s => {
      const entry = attendanceMap[s.id] || { status: 'Present' as AttendanceStatus, overtimeHours: 0 };
      return {
        staffId: s.id,
        staffName: s.name,
        date: selectedDate,
        status: entry.status,
        overtimeHours: entry.overtimeHours || 0,
        hoursWorked: entry.status === 'Present' ? 8 : entry.status === 'Half Day' ? 4 : 0
      };
    });

    await markAttendance(records);
    setAttendanceSavedMsg(true);
    setTimeout(() => setAttendanceSavedMsg(false), 3000);
  };

  // =========================================================================
  // TAB 3: LEAVE MANAGEMENT
  // =========================================================================
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveStaffId, setLeaveStaffId] = useState(staffMembers[0]?.id || '');
  const [leaveType, setLeaveType] = useState<LeaveRequest['leaveType']>('Casual');
  const [leaveStart, setLeaveStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [leaveDays, setLeaveDays] = useState('1');
  const [leaveReason, setLeaveReason] = useState('');

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    const st = staffMembers.find(s => s.id === leaveStaffId);
    if (!st) return;

    await submitLeaveRequest({
      staffId: st.id,
      staffName: st.name,
      leaveType,
      startDate: leaveStart,
      endDate: leaveStart,
      days: parseFloat(leaveDays) || 1,
      reason: leaveReason.trim() || 'Personal',
      status: 'Pending'
    });

    setIsLeaveModalOpen(false);
    setLeaveReason('');
  };

  // =========================================================================
  // TAB 4: RUN PAYROLL & PAYSLIPS
  // =========================================================================
  const [payrollMonth, setPayrollMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [bonusAdjustments, setBonusAdjustments] = useState<Record<string, number>>({});
  const [allowanceAdjustments, setAllowanceAdjustments] = useState<Record<string, number>>({});
  const [deductionAdjustments, setDeductionAdjustments] = useState<Record<string, number>>({});
  const [isRunningPayroll, setIsRunningPayroll] = useState(false);
  const [payrollSuccess, setPayrollSuccess] = useState<PayrollRun | null>(null);


  // =========================================================================
  // TAB 5: SALARY ADVANCES & LOANS STATE
  // =========================================================================
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceStaffId, setAdvanceStaffId] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [advanceMode, setAdvanceMode] = useState<'Cash' | 'Bank Transfer' | 'UPI'>('Cash');
  const [advanceReason, setAdvanceReason] = useState('');

  const handleDisburseAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(advanceAmount);
    if (!amt || amt <= 0) {
      alert('Please enter a valid advance amount');
      return;
    }
    const staff = staffMembers.find(s => s.id === advanceStaffId);
    if (!staff) {
      alert('Please select a staff member');
      return;
    }

    try {
      await recordStaffAdvance({
        staffId: staff.id,
        staffName: staff.name,
        amount: amt,
        date: advanceDate,
        reason: advanceReason.trim() || 'Salary advance request',
        disbursementMode: advanceMode,
        status: 'Pending Deduction'
      });
      setIsAdvanceModalOpen(false);
      setAdvanceAmount('');
      setAdvanceReason('');
      alert(`Advance of ${formatCurrency(amt)} successfully recorded for ${staff.name}.`);
    } catch (err: any) {
      alert('Failed to record advance: ' + err?.message);
    }
  };

  const handleRunPayrollAction = async () => {
    setIsRunningPayroll(true);
    try {
      const adj: Record<string, { bonus?: number; allowances?: number; deductions?: number }> = {};
      staffMembers.forEach(s => {
        adj[s.id] = {
          bonus: bonusAdjustments[s.id] || 0,
          allowances: allowanceAdjustments[s.id] || 0,
          deductions: deductionAdjustments[s.id] || 0
        };
      });

      const res = await runPayroll(payrollMonth, adj);
      setPayrollSuccess(res);
    } finally {
      setIsRunningPayroll(false);
    }
  };

  // Active Month Payslips
  const activeMonthPayslips = useMemo(() => {
    return payslips.filter(p => p.month === payrollMonth);
  }, [payslips, payrollMonth]);

  const tabs: TabItem[] = [
    { id: 'staff', label: 'Staff Directory', count: staffMembers.length, icon: Users },
    { id: 'attendance', label: 'Daily Attendance', icon: UserCheck },
    { id: 'leaves', label: 'Leaves', count: leaveRequests.filter((l: LeaveRequest) => l.status === 'Pending').length, icon: Calendar },
    { id: 'payroll', label: 'Run Payroll & Payslips', count: activeMonthPayslips.length, icon: DollarSign }
  ];

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <Briefcase className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                HR, Staff Attendance & Payroll
              </h2>
              <p className="text-xs text-slate-500">
                Staff directory, daily punch attendance, leaves, allowances & automated payroll disbursement.
              </p>
            </div>
          </div>
        </div>

        {activeTab === 'staff' && (
          <button
            type="button"
            onClick={handleOpenAddStaff}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff Member</span>
          </button>
        )}

        {activeTab === 'leaves' && (
          <button
            type="button"
            onClick={() => setIsLeaveModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Apply Leave</span>
          </button>
        )}
        {activeTab === 'advances' && (
          <button
            type="button"
            onClick={() => {
              setAdvanceStaffId(staffMembers[0]?.id || '');
              setIsAdvanceModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Disburse Salary Advance</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={id => setActiveTab(id as any)}
      />

      {/* TAB 1: STAFF DIRECTORY */}
      {activeTab === 'staff' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staffMembers.map(staff => (
            <div
              key={staff.id}
              className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-600">{staff.code}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                    {staff.employmentType}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1">
                  {staff.name}
                </h4>
                <p className="text-xs text-slate-500 font-medium">{staff.role} • {staff.department}</p>
                <p className="text-xs text-slate-400 mt-1">{staff.phone}</p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Salary ({staff.salaryType})</span>
                  <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
                    {formatCurrency(staff.baseSalary)}
                  </span>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <span>Leaves: {staff.allowedCasualLeaves} CL / {staff.allowedSickLeaves} SL</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: DAILY ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs p-4 space-y-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Select Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleMarkAllPresent}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Mark All Present
              </button>

              <button
                type="button"
                onClick={handleSaveAttendance}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer shadow-xs"
              >
                Save Attendance
              </button>
            </div>
          </div>

          {attendanceSavedMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
              ✓ Daily attendance saved successfully!
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                  <th className="py-2.5 px-3">Emp Code & Name</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Overtime (Hrs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {staffMembers.map(staff => {
                  const entry = attendanceMap[staff.id] || { status: 'Present' };
                  return (
                    <tr key={staff.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 dark:text-white block">{staff.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{staff.code}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-medium">
                        {staff.role}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                          {(['Present', 'Half Day', 'Absent', 'On Leave'] as const).map(st => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => setAttendanceMap(prev => ({
                                ...prev,
                                [staff.id]: { ...prev[staff.id], status: st }
                              }))}
                              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                entry.status === st
                                  ? st === 'Present'
                                    ? 'bg-emerald-600 text-white'
                                    : st === 'Absent'
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-amber-500 text-white'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          max="8"
                          value={entry.overtimeHours || 0}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setAttendanceMap(prev => ({
                              ...prev,
                              [staff.id]: { ...prev[staff.id], overtimeHours: val }
                            }));
                          }}
                          className="w-16 px-2 py-1 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LEAVES */}
      {activeTab === 'leaves' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Leave Applications</h3>
            <span className="text-xs text-slate-400">{leaveRequests.length} total applications</span>
          </div>

          <div className="space-y-2">
            {leaveRequests.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No leave applications recorded</p>
            ) : (
              leaveRequests.map((leave: LeaveRequest) => (
                <div
                  key={leave.id}
                  className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">{leave.staffName}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                        {leave.leaveType} Leave ({leave.days} day)
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        leave.status === 'Approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : leave.status === 'Rejected'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {leave.status}
                      </span>
                    </div>
                    <p className="text-slate-500 mt-1">Reason: {leave.reason} • From: {formatDate(leave.startDate)}</p>
                  </div>

                  {leave.status === 'Pending' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateLeaveStatus(leave.id, 'Approved')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => updateLeaveStatus(leave.id, 'Rejected')}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700 cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: RUN PAYROLL & PAYSLIPS */}
      {activeTab === 'payroll' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Payroll Month:</label>
              <input
                type="month"
                value={payrollMonth}
                onChange={e => setPayrollMonth(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              />
            </div>

            <button
              type="button"
              disabled={isRunningPayroll || staffMembers.length === 0}
              onClick={handleRunPayrollAction}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <DollarSign className="w-4 h-4" />
              <span>{isRunningPayroll ? 'Computing Payroll...' : `Run Payroll & Post Expense (${payrollMonth})`}</span>
            </button>
          </div>

          {payrollSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold">
              ✓ Payroll processed for {payrollSuccess.staffCount} employees! Total payout {formatCurrency(payrollSuccess.totalNetPayout)} automatically debited to Accounts Expense Voucher #{payrollSuccess.id}.
            </div>
          )}

          {/* Live Month Payroll Computation Matrix */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Base Salary</th>
                  <th className="py-2.5 px-3 text-center">Bonus (+)</th>
                  <th className="py-2.5 px-3 text-center">Allowances (+)</th>
                  <th className="py-2.5 px-3 text-center">Deductions (-)</th>
                  <th className="py-2.5 px-3 text-right">Est. Net Pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {staffMembers.map(s => {
                  const bonus = bonusAdjustments[s.id] || 0;
                  const allowance = allowanceAdjustments[s.id] || 0;
                  const deduction = deductionAdjustments[s.id] || 0;
                  const estimatedNet = Math.max(0, s.baseSalary + bonus + allowance - deduction);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 dark:text-white block">{s.name}</span>
                        <span className="text-[10px] text-slate-400">{s.role}</span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {formatCurrency(s.baseSalary)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          placeholder="₹0"
                          value={bonus || ''}
                          onChange={e => setBonusAdjustments(prev => ({ ...prev, [s.id]: parseFloat(e.target.value) || 0 }))}
                          className="w-20 px-2 py-1 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          placeholder="₹0"
                          value={allowance || ''}
                          onChange={e => setAllowanceAdjustments(prev => ({ ...prev, [s.id]: parseFloat(e.target.value) || 0 }))}
                          className="w-20 px-2 py-1 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          placeholder="₹0"
                          value={deduction || ''}
                          onChange={e => setDeductionAdjustments(prev => ({ ...prev, [s.id]: parseFloat(e.target.value) || 0 }))}
                          className="w-20 px-2 py-1 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                        />
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(estimatedNet)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Generated Payslips */}
          {activeMonthPayslips.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Generated Payslips for {payrollMonth} ({activeMonthPayslips.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {activeMonthPayslips.map(slip => (
                  <div key={slip.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 dark:text-white">{slip.staffName}</span>
                      <span className="font-mono font-bold text-emerald-600">{formatCurrency(slip.netPay)}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">Payslip #{slip.id.slice(-6)}</p>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="mt-2 w-full py-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-[11px] font-bold cursor-pointer"
                    >
                      Print Payslip
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Add/Edit Staff */}
      <Modal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
        title={editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
        size="xl"
      >
        <form onSubmit={handleSaveStaff} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Staff full name"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Role / Designation</label>
              <input
                type="text"
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="e.g. Salesperson, Cashier"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Employment Type</label>
              <select
                value={employmentType}
                onChange={e => setEmploymentType(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                <option value="Full Time">Full Time</option>
                <option value="Part Time">Part Time</option>
                <option value="Contract">Contract</option>
                <option value="Daily Wage">Daily Wage</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Salary Frequency</label>
              <select
                value={salaryType}
                onChange={e => setSalaryType(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                <option value="Monthly">Monthly</option>
                <option value="Hourly">Hourly</option>
                <option value="Daily">Daily</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Base Salary / Rate (₹)</label>
              <input
                type="number"
                value={baseSalary}
                onChange={e => setBaseSalary(e.target.value)}
                placeholder="18000"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsStaffModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
            >
              Save Staff Record
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Apply Leave */}
      <Modal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        title="Submit Leave Request"
        size="md"
      >
        <form onSubmit={handleSubmitLeave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Staff Member</label>
            <select
              value={leaveStaffId}
              onChange={e => setLeaveStaffId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
            >
              {staffMembers.map((s: StaffMember) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Leave Type</label>
              <select
                value={leaveType}
                onChange={e => setLeaveType(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                <option value="Casual">Casual Leave</option>
                <option value="Sick">Sick Leave</option>
                <option value="Earned">Earned Leave</option>
                <option value="Unpaid">Unpaid Leave</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Days</label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={leaveDays}
                onChange={e => setLeaveDays(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Reason</label>
            <textarea
              rows={2}
              value={leaveReason}
              onChange={e => setLeaveReason(e.target.value)}
              placeholder="Reason for leave"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsLeaveModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
            >
              Submit Application
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
