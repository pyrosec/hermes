# hermes

Perform hermes checkout workflow with a PayPal account and hermes token from a service that integrates Paypal Express Checkout.

## Usage
```
import { checkout } from "hermes";
const returnrUrl = await checkout({
  user: 'someemail@gmail.com',
  pass: 'passw0rd',
  token: 'EC-6TX96748R4897145F'
});
console.log('Return to ' + returnUrl + ' to finish the checkout.');

## License

MIT
