import { Component, type ReactNode } from 'react'
import { Icon } from '@iconify/react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="bg-card rounded-2xl border border-border p-8 max-w-md w-full text-center space-y-4">
            <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <Icon icon="solar:danger-triangle-bold" className="size-8 text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Une erreur est survenue</h1>
            <p className="text-muted-foreground text-sm">
              L'application a rencontré un problème inattendu.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false })
                window.location.href = '/'
              }}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
