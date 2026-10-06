interface UnityWebView {
	/** 유니티 C#으로 메시지(문자열)를 전송합니다. */
	call(message: string): void;
}

declare global {
	interface Window {
		/** gree/unity-webview에서 주입해주는 전역 객체 */
		Unity?: UnityWebView;

		/** 유니티(C#)에서 EvaluateJS로 호출해 줄 전역 함수들 정의 */
		onPurchaseComplete?: (result: string) => void;
		receiveUserData?: (nickname: string, gemCount: number) => void;
	}
}

export {};