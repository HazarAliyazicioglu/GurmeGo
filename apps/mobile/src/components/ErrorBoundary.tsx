import { Component, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

type Props = { children: ReactNode };
type State = { error: Error | null };

// React only exposes error-boundary behavior (catching a render-time throw and swapping in a
// fallback UI) through the class-component lifecycle -- there is no hook equivalent.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Sentry integration is Faz 2 (docs/infrastructure.md); until then, not swallowing the crash
    // silently is the bar -- it still reaches the device log.
    console.error("ErrorBoundary caught a render error:", error, info.componentStack);
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View>
          <Text>Bir şeyler ters gitti</Text>
          <Pressable onPress={this.retry}>
            <Text>Tekrar dene</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
