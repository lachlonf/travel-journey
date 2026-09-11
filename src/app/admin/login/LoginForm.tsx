"use client";

import { useActionState } from "react";
import { login, type FormState } from "../actions";
import { FormStatus } from "../FormStatus";

const initialState: FormState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="form">
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required autoFocus />
      </div>
      <FormStatus error={state.error} />
      <div>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Checking…" : "Enter"}
        </button>
      </div>
    </form>
  );
}
