import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck,
  Mail,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  RotateCcw,
  Info,
  Clock,
  ShieldAlert,
  Check
} from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const {
    requestPasswordResetOtp,
    verifyPasswordResetOtp,
    completePasswordReset,
    getActiveOtpState
  } = useAuth();
  const navigate = useNavigate();

  // Multi-step state: 1 = Email, 2 = Verify OTP, 3 = New Password, 4 = Success
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form Fields
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Security & Token Binding
  const [resetToken, setResetToken] = useState<string | null>(null);

  // UI & Feedback States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [neutralMessage, setNeutralMessage] = useState<string | null>(null);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  // Timers: Resend cooldown (seconds) and Expiry (seconds)
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(600); // 10 minutes
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(5);

  // SMTP Info Drawer
  const [showSmtpInfo, setShowSmtpInfo] = useState(false);

  // Restore active session state on initial load if available
  useEffect(() => {
    const active = getActiveOtpState();
    if (active && active.email && !active.used) {
      setEmail(active.email);
      if (active.verified && active.resetToken && Date.now() < (active.resetTokenExpiresAt || 0)) {
        setResetToken(active.resetToken);
        setCurrentStep(3);
      } else if (Date.now() < active.expiresAt) {
        setCurrentStep(2);
        setDevOtpHint(active.devOtp || null);
        const remainingExpiry = Math.max(0, Math.floor((active.expiresAt - Date.now()) / 1000));
        setExpirySeconds(remainingExpiry);
        setAttemptsRemaining(Math.max(0, active.maxAttempts - active.attempts));
      }
    }
  }, []);

  // Cooldown countdown effect
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // Expiry countdown effect for Step 2
  useEffect(() => {
    if (currentStep !== 2 || expirySeconds <= 0) return;
    const interval = setInterval(() => {
      setExpirySeconds((prev) => {
        if (prev <= 1) {
          setError('Verification code has expired. Please request a new code.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentStep, expirySeconds]);

  // STEP 1: Handle Request OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNeutralMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError('Please enter a valid business email address.');
      return;
    }

    if (cooldownSeconds > 0) {
      setError(`Please wait ${cooldownSeconds} seconds before requesting another code.`);
      return;
    }

    setLoading(true);
    const res = await requestPasswordResetOtp(cleanEmail);
    setLoading(false);

    if (res.success) {
      setNeutralMessage(res.message || 'If an account is associated with this email, an OTP has been sent.');
      setCooldownSeconds(60);
      setExpirySeconds(600);
      setAttemptsRemaining(5);
      setDevOtpHint(res.devOtp || null);
      setCurrentStep(2);
    } else {
      setError(res.error || 'Failed to dispatch verification code.');
    }
  };

  // Resend OTP Action
  const handleResendOtp = async () => {
    if (cooldownSeconds > 0 || loading) return;
    setError(null);
    setNeutralMessage(null);
    setLoading(true);

    const res = await requestPasswordResetOtp(email.trim().toLowerCase());
    setLoading(false);

    if (res.success) {
      setCooldownSeconds(60);
      setExpirySeconds(600);
      setAttemptsRemaining(5);
      setDevOtpHint(res.devOtp || null);
      setNeutralMessage('A fresh verification code has been dispatched to your email.');
    } else {
      setError(res.error || 'Failed to resend verification code.');
    }
  };

  // STEP 2: Handle Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanOtp = otpCode.trim().replace(/\s+/g, '');
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    if (expirySeconds <= 0) {
      setError('This verification code has expired. Please request a new code.');
      return;
    }

    setLoading(true);
    const res = await verifyPasswordResetOtp(email.trim().toLowerCase(), cleanOtp);
    setLoading(false);

    if (res.success && res.resetToken) {
      setResetToken(res.resetToken);
      setCurrentStep(3);
    } else {
      if (res.remainingAttempts !== undefined) {
        setAttemptsRemaining(res.remainingAttempts);
      }
      setError(res.error || 'Invalid or expired verification code.');
    }
  };

  // STEP 3: Handle Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!resetToken) {
      setError('Missing authorization token. You must verify an OTP before resetting your password.');
      setCurrentStep(1);
      return;
    }

    const cleanPass = newPassword.trim();
    if (cleanPass.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (cleanPass !== confirmPassword.trim()) {
      setError('New password and confirmation password do not match.');
      return;
    }

    setLoading(true);
    const res = await completePasswordReset({
      email: email.trim().toLowerCase(),
      resetToken,
      newPassword: cleanPass
    });
    setLoading(false);

    if (res.success) {
      setCurrentStep(4);
    } else {
      setError(res.error || 'Failed to reset password. Please verify your OTP again.');
    }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Branding Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mb-3 shadow-lg shadow-indigo-500/10">
            {currentStep === 1 && <Mail className="w-7 h-7" />}
            {currentStep === 2 && <KeyRound className="w-7 h-7" />}
            {currentStep === 3 && <Lock className="w-7 h-7" />}
            {currentStep === 4 && <CheckCircle2 className="w-7 h-7 text-emerald-400" />}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {currentStep === 1 && 'Account Recovery'}
            {currentStep === 2 && 'Verify Security Code'}
            {currentStep === 3 && 'Set New Password'}
            {currentStep === 4 && 'Recovery Complete'}
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            {currentStep === 1 && 'Enter your registered email to receive a 6-digit one-time code.'}
            {currentStep === 2 && 'Enter the 6-digit code dispatched to your registered email.'}
            {currentStep === 3 && 'Choose a strong password with at least 6 characters.'}
            {currentStep === 4 && 'Your password has been successfully updated.'}
          </p>
        </div>

        {/* Step Indicator (Steps 1 to 3) */}
        {currentStep < 4 && (
          <div className="flex items-center justify-between mb-5 px-3">
            {[
              { num: 1, label: 'Email' },
              { num: 2, label: 'Verify OTP' },
              { num: 3, label: 'New Password' }
            ].map((step, idx) => (
              <React.Fragment key={step.num}>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${
                      currentStep === step.num
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : currentStep > step.num
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {currentStep > step.num ? <Check className="w-3.5 h-3.5" /> : step.num}
                  </div>
                  <span
                    className={`text-[11px] font-medium ${
                      currentStep === step.num
                        ? 'text-white'
                        : currentStep > step.num
                        ? 'text-slate-300'
                        : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < 2 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${
                      currentStep > step.num ? 'bg-emerald-500/40' : 'bg-slate-800'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Card Body */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          {/* Neutral Info / Status Banner */}
          {neutralMessage && (
            <div className="mb-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-2.5 text-indigo-300 text-xs">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
              <span>{neutralMessage}</span>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 1: ENTER REGISTERED EMAIL */}
          {/* ---------------------------------------------------- */}
          {currentStep === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Business / Account Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    placeholder="e.g. admin@gmail.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-700/60 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Applicable to all account roles (Administrator, Cashier, Sales, Manager).
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="mt-5 pt-4 border-t border-slate-800 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 2: VERIFY 6-DIGIT EMAIL OTP */}
          {/* ---------------------------------------------------- */}
          {currentStep === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {/* Target Email Card */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="block text-[10px] text-slate-400">Verification Sent To</span>
                  <span className="text-xs font-semibold text-white font-mono">{email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep(1);
                    setError(null);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline cursor-pointer"
                >
                  Change
                </button>
              </div>

              {/* 6-Digit OTP Input Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    6-Digit One-Time Code
                  </label>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    Expires in: <strong className="text-amber-300 font-mono">{formatTime(expirySeconds)}</strong>
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    autoFocus
                    value={otpCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setOtpCode(val);
                      setError(null);
                    }}
                    placeholder="••••••"
                    className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3 bg-slate-950/60 border border-slate-700/60 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                  <span>
                    Remaining attempts:{' '}
                    <strong className="text-slate-200">{attemptsRemaining ?? 5}/5</strong>
                  </span>
                  {devOtpHint && (
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono border border-indigo-500/30">
                      Code: {devOtpHint}
                    </span>
                  )}
                </div>
              </div>

              {/* Verify OTP Button */}
              <button
                type="submit"
                disabled={loading || otpCode.length !== 6 || expirySeconds <= 0}
                className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Code & Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Resend OTP Bar */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={cooldownSeconds > 0 || loading}
                  className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 font-medium flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>
                    {cooldownSeconds > 0
                      ? `Resend Code in ${cooldownSeconds}s`
                      : 'Resend Verification Code'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-xs text-slate-400 hover:text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 3: SET NEW PASSWORD */}
          {/* ---------------------------------------------------- */}
          {currentStep === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Identity verified. Please set your new account password.</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-950/60 border border-slate-700/60 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="mt-1 text-[10px]">
                  <span
                    className={
                      newPassword.length >= 6 ? 'text-emerald-400 font-medium' : 'text-slate-400'
                    }
                  >
                    ✓ Minimum 6 characters {newPassword && `(${newPassword.length}/6)`}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="••••••••••••"
                    className={`w-full pl-10 pr-10 py-2.5 bg-slate-950/60 border rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
                      confirmPassword && newPassword !== confirmPassword
                        ? 'border-rose-500/60 focus:ring-rose-500'
                        : confirmPassword && newPassword === confirmPassword
                        ? 'border-emerald-500/60 focus:ring-emerald-500'
                        : 'border-slate-700/60 focus:ring-indigo-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && (
                  <div className="mt-1 text-[10px]">
                    <span
                      className={
                        newPassword === confirmPassword
                          ? 'text-emerald-400 font-medium'
                          : 'text-rose-400 font-medium'
                      }
                    >
                      {newPassword === confirmPassword
                        ? '✓ Passwords match'
                        : '✗ Passwords do not match'}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
                className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Resetting Password...</span>
                  </>
                ) : (
                  <>
                    <span>Save & Update Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 4: SUCCESS CONFIRMATION */}
          {/* ---------------------------------------------------- */}
          {currentStep === 4 && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Password Updated!</h3>
              <p className="text-slate-400 text-xs mt-2 mb-6 max-w-xs mx-auto leading-relaxed">
                Your account password has been updated securely. You can now use your new password to sign into your Universal ERP workspace.
              </p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-3 px-5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/25 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Supabase SMTP Configuration Guide Helper */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setShowSmtpInfo(!showSmtpInfo)}
            className="text-[11px] text-slate-500 hover:text-slate-400 inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Email Delivery & Provider Settings</span>
          </button>

          {showSmtpInfo && (
            <div className="mt-2.5 p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl text-left text-[11px] text-slate-300 space-y-2 animate-fadeIn shadow-xl">
              <div className="font-semibold text-white flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                <span>Supabase Email Delivery Configuration</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                The application dispatches password recovery codes via your Supabase project (<strong>zdygiubhmxuonzqchehp</strong>).
              </p>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1 font-mono text-[10px] text-slate-300">
                <div>• Provider: Supabase Auth (GoTrue)</div>
                <div>• Built-in SMTP Limit: ~3-4 emails/hr</div>
                <div>• Unlimited SMTP: Set in Dashboard &gt; Auth &gt; SMTP Provider</div>
                <div>• Email Template: In Auth &gt; Templates, include <code>{'{{ .Token }}'}</code> for 6-digit OTP</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
