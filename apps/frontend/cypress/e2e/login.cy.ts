describe('Login page', () => {
  it('renders the sign-in form for unauthenticated visitors', () => {
    cy.visit('/')
    cy.contains('h1', 'Sign in')
    cy.get('#email').should('be.visible')
    cy.get('#password').should('be.visible')
  })

  it('redirects protected routes to the login page without a session', () => {
    cy.visit('/overview')
    cy.location('pathname').should('eq', '/')
    cy.contains('h1', 'Sign in')
  })
})
