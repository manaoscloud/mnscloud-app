
import {
    Component,
    computed,
    inject,
    signal
} from '@angular/core';
import {
    FormBuilder,
    ReactiveFormsModule,
    Validators,
    AbstractControl,
    ValidationErrors
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

import { ApiService } from '../../services/api.service';
import { fadeIn } from '../../shared/animations/fade.animation';

@Component({
    standalone: true,
    selector: 'app-reset-password',
    templateUrl: './reset-password.html',
    styleUrls: ['./reset-password.scss'],
    imports: [
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule
],
    animations: [fadeIn]
})
export class ResetPasswordComponent {

    private fb = inject(FormBuilder);
    private api = inject(ApiService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);

    // 🔥 Agora só token — email foi removido do fluxo
    private token = this.route.snapshot.queryParamMap.get('token');

    readonly isLoading = signal(false);
    readonly apiError = signal<string | null>(null);
    readonly success = signal(false);
    readonly showPassword = signal(false);

    readonly formValid = signal(false);

    readonly form = this.fb.group(
        {
            newPassword: ['', [Validators.required, Validators.minLength(8)]],
            confirmPassword: ['', [Validators.required]]
        },
        {
            validators: (group: AbstractControl): ValidationErrors | null => {
                const a = group.get('newPassword')?.value;
                const b = group.get('confirmPassword')?.value;
                return a && b && a !== b ? { passwordMismatch: true } : null;
            }
        }
    );

    constructor() {
        this.form.statusChanges.subscribe(() => {
            this.formValid.set(this.form.valid);
        });
    }

    readonly canSubmit = computed(() =>
        this.formValid() && !this.isLoading()
    );

    togglePassword() {
        this.showPassword.update(v => !v);
    }

    async onSubmit(event: Event) {
        event.preventDefault();

        if (!this.form.valid) {
            this.form.markAllAsTouched();
            return;
        }

        // 🔥 Agora valida SOMENTE o token
        if (!this.token) {
            this.apiError.set('Invalid or expired reset link. Please request a new one.');
            return;
        }

        this.apiError.set(null);
        this.isLoading.set(true);

        const newPassword = this.form.get('newPassword')!.value;

        try {
            await this.api.post('auth/reset-password', {
                token: this.token,
                newPassword
            });

            this.success.set(true);

            setTimeout(() => {
                this.router.navigate(['/signin']);
            }, 2000);

        } catch (err: any) {
            const msg =
                err?.error?.message ||
                err?.error?.error ||
                err?.message ||
                'Unable to reset password. Please try again.';
            this.apiError.set(msg);
        } finally {
            this.isLoading.set(false);
        }
    }
}