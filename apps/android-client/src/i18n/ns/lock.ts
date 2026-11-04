import type { Messages } from "../index";

export const zh: Messages = {
  "lock.title.setup": "设置应用密码",
  "lock.title.unlock": "输入应用密码",
  "lock.setup.hint": "手机被别人拿到时，需要这个密码才能打开。\n忘记密码只能清除数据重来，没有找回方式。",
  "lock.input.aria.setup": "设置密码输入框",
  "lock.input.aria.unlock": "应用密码输入框",
  "lock.input.placeholder": "••••",
  "lock.input.confirm.aria": "再次输入密码",
  "lock.input.confirm.placeholder": "再输一次",
  "lock.error.mismatch": "两次输入的密码不一致",
  "lock.error.attemptsExhausted": "尝试次数已用尽",
  "lock.error.wrongPin": "密码不正确，还可以尝试 {count} 次",
  "lock.hint.attemptsLeft": "还可以尝试 {count} 次",
  "lock.button.enable": "启用",
  "lock.button.unlock": "解锁",
  "lock.button.biometric": "用指纹解锁",
  "lock.button.cancel": "取消",
  "lock.footer.maxAttempts": "连续输错 {count} 次将清除本机数据",
};

export const en: Messages = {
  "lock.title.setup": "Set App Passcode",
  "lock.title.unlock": "Enter App Passcode",
  "lock.setup.hint":
    "If someone else gets hold of your phone, this passcode is needed to open the app.\nIf you forget it, the only option is to erase data and start over. There is no way to recover it.",
  "lock.input.aria.setup": "Set passcode input field",
  "lock.input.aria.unlock": "App passcode input field",
  "lock.input.placeholder": "••••",
  "lock.input.confirm.aria": "Re-enter passcode",
  "lock.input.confirm.placeholder": "Enter again",
  "lock.error.mismatch": "The two passcodes do not match",
  "lock.error.attemptsExhausted": "No attempts left",
  "lock.error.wrongPin": "Incorrect passcode. {count} attempts left",
  "lock.hint.attemptsLeft": "{count} attempts left",
  "lock.button.enable": "Enable",
  "lock.button.unlock": "Unlock",
  "lock.button.biometric": "Unlock with fingerprint",
  "lock.button.cancel": "Cancel",
  "lock.footer.maxAttempts": "{count} wrong attempts in a row will erase data on this device",
};

export const es: Messages = {
  "lock.title.setup": "Configurar contraseña de la app",
  "lock.title.unlock": "Ingresa la contraseña de la app",
  "lock.setup.hint":
    "Si otra persona tiene tu teléfono, necesita esta contraseña para abrir la app.\nSi la olvidas, solo puedes borrar los datos y empezar de nuevo. No hay forma de recuperarla.",
  "lock.input.aria.setup": "Campo para configurar la contraseña",
  "lock.input.aria.unlock": "Campo de contraseña de la app",
  "lock.input.placeholder": "••••",
  "lock.input.confirm.aria": "Vuelve a ingresar la contraseña",
  "lock.input.confirm.placeholder": "Ingrésala otra vez",
  "lock.error.mismatch": "Las dos contraseñas no coinciden",
  "lock.error.attemptsExhausted": "No quedan intentos",
  "lock.error.wrongPin": "Contraseña incorrecta. Te quedan {count} intentos",
  "lock.hint.attemptsLeft": "Te quedan {count} intentos",
  "lock.button.enable": "Activar",
  "lock.button.unlock": "Desbloquear",
  "lock.button.biometric": "Desbloquear con huella",
  "lock.button.cancel": "Cancelar",
  "lock.footer.maxAttempts": "{count} intentos fallidos seguidos borrarán los datos de este dispositivo",
};
