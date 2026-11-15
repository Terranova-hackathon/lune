import { afterNextRender, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth-service';
import { HttpErrorResponse } from '@angular/common/http';
import { safeReturnUrl } from '../../core/utils/return-url';

/** Form-level check: both password fields filled in and different. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { passwordMismatch: true } : null;
}

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-register',
  styleUrl: './register.scss',
  templateUrl: './register.html',
})
export class Register {
  private readonly buildform = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly nameInput = viewChild.required<ElementRef<HTMLInputElement>>('nameInput');

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
		afterNextRender(() => this.nameInput().nativeElement.focus());
	}

  readonly form = this.buildform.nonNullable.group({
    // Optional; minLength/maxLength only apply when a name is entered. Matches the backend's 2-20 rule.
    displayName: ['', [Validators.minLength(2), Validators.maxLength(20)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [
      Validators.required, Validators.minLength(8),
      Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).+$/)
    ]],
    confirmPassword: ['', Validators.required],
    acceptedPrivacyPolicy: [false, Validators.requiredTrue]
  }, { validators: passwordsMatch });

  /** True when the field should show its error state. */
  showError(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  /** The confirm field is also invalid when the two passwords differ. */
  showConfirmError(): boolean {
    const confirm = this.form.controls.confirmPassword;
    return confirm.touched && (confirm.invalid || this.form.hasError('passwordMismatch'));
  }

  onSubmit(): void {
    if (this.loading()) {
      return;
    }
    this.error.set(null);

    if (this.form.invalid) {
      // Shows every field's message, including the password mismatch.
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();
    this.loading.set(true);
    this.auth.register({
      email: values.email,
      password: values.password,
      displayName: values.displayName.trim() || null,
      acceptedPrivacyPolicy: values.acceptedPrivacyPolicy
    }).subscribe({
      next: () => {
        this.loading.set(false);
        const returnUrl = safeReturnUrl(
          this.route.snapshot.queryParamMap.get('returnUrl')
        );
        this.router.navigateByUrl(returnUrl);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.messageFor(err));
      }
    });
  }

  /** Turns the server's response into a message, using its own wording where there is one. */
  private messageFor(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'Cannot connect to the server.';
    }
    // Validation problems list their messages per field, e.g. { "DisplayName": ["This display name is already in use."] }.
    const errors = err.error?.errors as Record<string, string[]> | undefined;
    if (err.status === 400 && errors) {
      const messages = [...new Set(Object.values(errors).flat())];
      if (messages.length) {
        return messages.join(' ');
      }
    }
    return err.error?.detail ?? err.error?.title ?? 'Registration failed. Please try again.';
  }
}
