import { Component, signal, inject } from '@angular/core';

import {
    ReactiveFormsModule,
    FormBuilder,
    FormGroup,
    Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { merge } from 'rxjs';
import { Router, RouterModule } from '@angular/router';
import { fadeIn } from '../../shared/animations/fade.animation';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';

import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';
import { PhoneInputComponent } from '../../shared/phone-input/phone-input.component';
import { DateMaskDirective } from '../../shared/date-mask/date-mask.directive';

@Component({
    selector: 'app-signup',
    standalone: true,
    imports: [
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    PhoneInputComponent,
    DateMaskDirective
],
    templateUrl: './signup.html',
    styleUrls: ['./signup.scss'],
    animations: [fadeIn],
})
export class Signup {
    private readonly fb = inject(FormBuilder);
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);
    private readonly snack = inject(SnackbarService);

    readonly form: FormGroup = this.fb.group({
        firstName: ['', [Validators.required, Validators.minLength(2)]],
        lastName: ['', [Validators.required, Validators.minLength(2)]],
        phone: ['', [Validators.required, Validators.pattern(/^\d{8,15}$/)]],
        email: ['', [Validators.required, Validators.email]],
        dateBirth: [null, [Validators.required]],
        password: ['', [Validators.required, Validators.minLength(6)]],
    });

    readonly showPassword = signal(false);
    readonly isLoading = signal(false);
    readonly apiError = signal<string | null>(null);
    readonly successMessage = signal<string | null>(null);
    readonly emailError = signal('');

    constructor() {
        merge(this.form.get('email')!.statusChanges, this.form.get('email')!.valueChanges)
            .pipe(takeUntilDestroyed())
            .subscribe(() => this.updateEmailError());
    }

    get canSubmit(): boolean {
        return this.form.valid && !this.isLoading();
    }

    async onSubmit(event?: Event) {
        event?.preventDefault();

        if (!this.canSubmit) return;

        this.isLoading.set(true);
        this.apiError.set(null);
        this.successMessage.set(null);

        try {
            const value = this.form.getRawValue();

            const dateBirthStr =
                value.dateBirth instanceof Date
                    ? value.dateBirth.toISOString().substring(0, 10)
                    : (value.dateBirth ?? '');

            const result = await this.api.post<any>('auth/signup', {
                firstName: value.firstName,
                lastName: value.lastName,
                phone: value.phone,
                email: value.email,
                password: value.password,
                dateBirth: dateBirthStr,
            });

            if (!result?.message) {
                throw new Error('Invalid API response.');
            }

            this.successMessage.set('Account created successfully. Logging you in...');
            this.snack.success('Account created successfully!');

            // Faz login automático
            const login = await this.api.post<any>('auth/signin', {
                email: value.email,
                password: value.password,
            });

            if (!login?.jwt) {
                throw new Error('Could not complete automatic sign-in.');
            }

            await this.auth.login(login.jwt, null, this.api);
            this.snack.success('Welcome!');
            await this.router.navigate(['/dashboard']);
        } catch (err: any) {
            const msg =
                err?.error?.error ||
                err?.message ||
                'Registration failed.';
            this.apiError.set(msg);
            this.snack.error(msg);
        }

        this.isLoading.set(false);
    }

    togglePassword(event?: MouseEvent) {
        this.showPassword.set(!this.showPassword());
        event?.stopPropagation();
    }

    updateEmailError() {
        const control = this.form.get('email');
        if (!control) return;
        if (control.hasError('required')) {
            this.emailError.set('You must enter a value');
        } else if (control.hasError('email')) {
            this.emailError.set('Not a valid email');
        } else {
            this.emailError.set('');
        }
    }
}
